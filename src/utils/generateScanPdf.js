import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const DARK_BLUE = '#1e3a5f'
const ACCENT_BLUE = '#2563eb'
const DARK_GRAY = '#374151'
const LIGHT_GRAY = '#6b7280'
const VERDICT_REAL = '#047857'
const VERDICT_FAKE = '#b91c1c'


/**
 * Convert raw model score to display percentage (matches UI: RealTimeAnalysis uses raw * 100).
 * API returns 0-1 for ai_generated, deepfake, quality.
 */
function toDisplayScore(raw) {
  if (raw == null || raw === undefined) return null
  const n = Number(raw)
  if (Number.isNaN(n)) return null
  if (n <= 1 && n >= 0) return `${Math.round(n * 100)}%`
  return `${Math.round(n)}%`
}

/**
 * Get display value for a model in the breakdown.
 * - Not in scannedModels → "Not Requested"
 * - In scannedModels, has score → show score (e.g. "94%")
 * - In scannedModels, no score → "Not Applicable"
 */
function getModelStatus(modelId, scannedModels, modelScores, aiSignatures) {
  const wasRequested = Array.isArray(scannedModels) && scannedModels.includes(modelId)
  if (!wasRequested) return 'Not Requested'

  if (modelId === 'type') {
    if (!aiSignatures) return 'Not Applicable'
    const parts = []
    if (aiSignatures.missingExif) parts.push('Missing EXIF')
    if (aiSignatures.suspiciousResolution) parts.push(`Resolution: ${aiSignatures.suspiciousResolution}`)
    if (aiSignatures.softwareTags?.length) parts.push(`AI tags: ${aiSignatures.softwareTags.join(', ')}`)
    return parts.length ? parts.join('; ') : 'Verified'
  }

  const key = modelId === 'genai' ? 'ai_generated' : modelId === 'deepfake' ? 'deepfake' : modelId === 'quality' ? 'quality' : null
  if (!key || !modelScores) return 'Not Applicable'
  const score = toDisplayScore(modelScores[key])
  return score ?? 'Not Applicable'
}

/**
 * Get display value for a video analysis model in the breakdown.
 * Maps: genai → ai_generated, deepfake → deepfake, voice_clone → voiceCloneReasoning, lip_sync → lipSyncIntegrity.
 */
/**
 * Video scannedModels from API: genai, deepfake, voice_clone, lip_sync.
 * temporal_ai + frame_integrity both map to genai.
 */
function getVideoModelStatus(modelId, scannedModels, modelScores, metadata) {
  const wasRequested = Array.isArray(scannedModels) && (
    scannedModels.includes(modelId) ||
    (modelId === 'genai' && scannedModels.some((m) => ['genai', 'temporal_ai', 'frame_integrity'].includes(m)))
  )
  if (!wasRequested) return 'Not Requested'

  if (modelId === 'voice_clone') {
    const v = metadata?.audioAnalysis?.voiceCloneReasoning ?? modelScores?.voice_clone_reasoning
    return (typeof v === 'string' && v.trim()) ? v : 'Not Applicable'
  }
  if (modelId === 'lip_sync') {
    const v = metadata?.lipSyncIntegrity ?? modelScores?.lip_sync_integrity
    return toDisplayScore(v) ?? 'Not Applicable'
  }
  const key = modelId === 'genai' ? 'ai_generated' : modelId === 'deepfake' ? 'deepfake' : null
  if (!key || !modelScores) return 'Not Applicable'
  const score = toDisplayScore(modelScores[key])
  return score ?? 'Not Applicable'
}

/**
 * Build detection signals list from aiSignatures for PDF display.
 * @param {object} aiSignatures - { missingExif, suspiciousResolution, softwareTags }
 * @param {object} t - i18n translate function
 * @returns {string[]} List of signal labels
 */
export function getDetectionSignals(aiSignatures, t) {
  if (!aiSignatures) return []
  const signals = []
  if (aiSignatures.missingExif) {
    signals.push(t?.('verdict.ai_missing_exif') || 'Missing EXIF metadata (common in AI-generated images)')
  }
  if (aiSignatures.suspiciousResolution) {
    const res = aiSignatures.suspiciousResolution
    signals.push(
      t?.('verdict.ai_suspicious_resolution', { res }) ||
        `Suspicious resolution ${res} (typical of AI tools)`
    )
  }
  if (aiSignatures.softwareTags?.length) {
    const tags = aiSignatures.softwareTags.join(', ')
    signals.push(
      t?.('verdict.ai_software_detected', { tags }) ||
        `AI software tags detected: ${tags}`
    )
  }
  return signals
}

/**
 * Generate a PDF report for a scan result using jspdf and jspdf-autotable.
 * @param {object} opts
 * @param {number} opts.score - Raw winning percentage (e.g. 97)
 * @param {string} opts.status - 'REAL' | 'FAKE'
 * @param {string} [opts.fileName] - Original file name
 * @param {string} [opts.fileHash] - SHA-256 hash of file
 * @param {object} [opts.aiSignatures] - Detection signals
 * @param {object} [opts.modelScores] - Per-model scores
 * @param {string[]} [opts.scannedModels] - Which models were requested (genai, deepfake, type, quality)
 * @param {object} [opts.metadata] - File metadata (mediaCategory, duration, resolution, etc.)
 * @param {string} [opts.expertSummary] - AI Expert Interpretation (Elite)
 * @param {function} [opts.t] - i18n translate
 */
export function generateScanPdf(opts) {
  const {
    score = 0,
    status = 'REAL',
    fileName = 'Unknown file',
    fileHash = null,
    aiSignatures = null,
    modelScores = null,
    scannedModels = null,
    metadata = null,
    expertSummary = null,
    mediaCategory = null,
    t,
  } = opts

  const mediaType = mediaCategory ?? metadata?.mediaCategory ?? 'image'
  const isVideo = mediaType === 'video'

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 50
  let y = 50

  // VerifEye logo (text)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_BLUE)
  doc.text('VerifEye', margin, y)
  y += 18

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(LIGHT_GRAY)
  doc.text(t?.('pdf.report_title') || 'Media Verification Report', margin, y)
  y += 30

  // Divider
  doc.setFillColor(DARK_BLUE)
  doc.rect(margin, y, pageWidth - margin * 2, 2, 'F')
  y += 25

  // Scan details
  const dateFormatted = new Date().toLocaleString(undefined, {
    dateStyle: 'long',
    timeStyle: 'medium',
  })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_GRAY)
  doc.text(t?.('pdf.file_name') || 'File Name:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(fileName || '—', margin + 90, y)
  y += 20

  if (fileHash) {
    doc.setFont('helvetica', 'bold')
    doc.text(t?.('pdf.file_hash') || 'File Hash (SHA-256):', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(fileHash, margin + 110, y, { maxWidth: pageWidth - margin - 120 })
    doc.setFontSize(11)
    y += 24
  }

  doc.setFont('helvetica', 'bold')
  doc.text(t?.('pdf.date_time') || 'Date & Time:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dateFormatted, margin + 90, y)
  y += 28

  // Verdict section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_BLUE)
  doc.text(t?.('pdf.verdict') || 'Verdict', margin, y)
  y += 22

  const resultColor = status === 'REAL' ? VERDICT_REAL : VERDICT_FAKE
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(resultColor)
  doc.text(status, margin, y)
  doc.text(`${score}%`, margin + 70, y)
  y += 40

  // Credibility Meter (Fake News Detection)
  if (metadata?.credibility) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK_BLUE)
    doc.text(t?.('pdf.credibility_meter') || 'Credibility Meter (Fake News Detection)', margin, y)
    y += 16
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(DARK_GRAY)
    const scoreLabel = t?.('pdf.credibility_score') || 'Score'
    const scoreVal = metadata.credibility.error
      ? (t?.('pdf.credibility_unavailable') || 'N/A')
      : `${metadata.credibility.score}%`
    doc.text(`${scoreLabel}: ${scoreVal}`, margin, y)
    y += 14
    if (metadata.credibility.reasoning && !metadata.credibility.error) {
      const credLines = doc.splitTextToSize(metadata.credibility.reasoning, pageWidth - margin * 2)
      doc.text(credLines, margin, y)
      y += credLines.length * 12 + 20
    } else {
      y += 20
    }
  }

  // AI Expert Interpretation (DeepSeek) - directly under Verdict line
  const summary = expertSummary || metadata?.expertSummary
  if (summary) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK_BLUE)
    doc.text(t?.('pdf.ai_expert') || 'AI Expert Interpretation (DeepSeek Analyst)', margin, y)
    y += 16
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(DARK_GRAY)
    const lines = doc.splitTextToSize(summary, pageWidth - margin * 2)
    doc.text(lines, margin, y)
    y += lines.length * 14 + 20
  }

  // Detection signals
  const signals = getDetectionSignals(aiSignatures, t)
  if (signals.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK_BLUE)
    doc.text(t?.('pdf.detection_signals') || 'Detection Signals', margin, y)
    y += 20

    autoTable(doc, {
      startY: y,
      head: [['Signal']],
      body: signals.map((s) => [s]),
      theme: 'plain',
      headStyles: { fillColor: DARK_BLUE, textColor: '#fff', fontStyle: 'bold' },
      bodyStyles: { textColor: DARK_GRAY, fontSize: 10 },
      columnStyles: { 0: { cellWidth: pageWidth - margin * 2 - 20 } },
      margin: { left: margin },
      tableWidth: pageWidth - margin * 2,
    })
    y = doc.lastAutoTable.finalY + 20
  }

  // Analysis Breakdown – Video template vs Photo template
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_BLUE)
  doc.text(t?.('pdf.analysis_breakdown') || 'Analysis Breakdown', margin, y)
  y += 20

  const modelRows = isVideo
    ? [
        ['Temporal AI Consistency', getVideoModelStatus('genai', scannedModels, modelScores, metadata)],
        ['Video Deepfake Detection', getVideoModelStatus('deepfake', scannedModels, modelScores, metadata)],
        ['Frame Integrity', getVideoModelStatus('genai', scannedModels, modelScores, metadata)],
        ['Voice Clone Detection', getVideoModelStatus('voice_clone', scannedModels, modelScores, metadata)],
        ['Lip-Sync Integrity', getVideoModelStatus('lip_sync', scannedModels, modelScores, metadata)],
      ]
    : [
        ['Deepfake Detection', getModelStatus('deepfake', scannedModels, modelScores, aiSignatures)],
        ['AI Pixel Analysis', getModelStatus('genai', scannedModels, modelScores, aiSignatures)],
        ['Metadata Check', getModelStatus('type', scannedModels, modelScores, aiSignatures)],
        ['Image Quality', getModelStatus('quality', scannedModels, modelScores, aiSignatures)],
      ]
  autoTable(doc, {
    startY: y,
    head: [[t?.('pdf.analysis_type') || 'Analysis Type', t?.('pdf.status') || 'Status']],
    body: modelRows,
    theme: 'striped',
    headStyles: { fillColor: DARK_BLUE, textColor: '#fff', fontStyle: 'bold' },
    bodyStyles: { textColor: DARK_GRAY, fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 150 },
      1: { cellWidth: pageWidth - margin * 2 - 150, cellPadding: 4 },
    },
    margin: { left: margin },
    tableWidth: pageWidth - margin * 2,
  })
  y = doc.lastAutoTable.finalY + 20

  // Metadata snippet (image or video)
  const hasMetadata = metadata && (metadata.fileType || metadata.sizeFormatted || metadata.extension || isVideo)
  if (hasMetadata) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK_BLUE)
    doc.text(isVideo ? (t?.('pdf.video_metadata') || 'Video Metadata') : (t?.('pdf.file_metadata') || 'File Metadata'), margin, y)
    y += 20

    const metaRows = []
    if (metadata?.fileType || metadata?.extension) {
      metaRows.push(['Type', metadata.fileType || metadata.extension || '—'])
    }
    if (metadata?.sizeFormatted || metadata?.size != null) {
      metaRows.push(['Size', metadata.sizeFormatted || `${metadata.size ?? 0} B`])
    }
    if (!isVideo && metadata?.resolution) {
      metaRows.push(['Resolution', metadata.resolution])
    }
    if (!isVideo && metadata?.createdAt) {
      metaRows.push(['Created', String(metadata.createdAt)])
    }
    if (isVideo) {
      if (metadata?.duration != null) metaRows.push(['Duration', String(metadata.duration)])
      if (metadata?.resolution) metaRows.push(['Resolution', String(metadata.resolution)])
      if (metadata?.frameRate != null) metaRows.push(['Frame Rate', `${metadata.frameRate} fps`])
      metaRows.push(['Frames Analyzed', metadata?.framesAnalyzed != null ? String(metadata.framesAnalyzed) : '—'])
      metaRows.push(['Analysis Method', metadata?.analysisMethod === 'native_video' ? 'Native Video (Sequential)' : metadata?.analysisMethod === 'frame_based' ? 'Frame-Based (Fast)' : '—'])
      if (metadata?.lipSyncIntegrity != null) {
        metaRows.push(['Lip-Sync Integrity', toDisplayScore(metadata.lipSyncIntegrity) ?? '—'])
      }
      if (metadata?.audioAnalysis?.voiceCloneReasoning) {
        metaRows.push(['Voice Clone', 'DeepSeek (metadata + lip-sync)'])
      }
    }
    if (metaRows.length > 0) {
      autoTable(doc, {
        startY: y,
        body: metaRows,
        theme: 'plain',
        bodyStyles: { textColor: DARK_GRAY, fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold' },
          1: { cellWidth: pageWidth - margin * 2 - 80 },
        },
        margin: { left: margin },
        tableWidth: pageWidth - margin * 2,
      })
      y = doc.lastAutoTable.finalY + 20
    }
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(LIGHT_GRAY)
  doc.setFont('helvetica', 'normal')
  doc.text(
    'Generated by VerifEye — Truth Layer. This report is for informational purposes only.',
    margin,
    doc.internal.pageSize.getHeight() - 30
  )

  return doc
}
