import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const DARK_BLUE = '#1e3a5f'
const ACCENT_BLUE = '#2563eb'
const DARK_GRAY = '#374151'
const LIGHT_GRAY = '#6b7280'
const VERDICT_REAL = '#047857'
const VERDICT_FAKE = '#b91c1c'

/** Helvetica lacks Romanian diacritics (ș, ă, ț, etc.). Convert to ASCII for clean PDF rendering. */
function toPdfSafe(str) {
  if (typeof str !== 'string') return str
  return str
    .replace(/ș/g, 's').replace(/Ș/g, 'S')
    .replace(/ț/g, 't').replace(/Ț/g, 'T')
    .replace(/ă/g, 'a').replace(/Ă/g, 'A')
    .replace(/â/g, 'a').replace(/Â/g, 'A')
    .replace(/î/g, 'i').replace(/Î/g, 'I')
}

/** Extract valid 64-char SHA256 hex from fileHash (handles corrupt prefixes). */
function sanitizeFileHash(h) {
  if (!h || typeof h !== 'string') return null
  const hex = h.match(/[a-fA-F0-9]{64}/)?.[0]
  return hex || (/^[a-fA-F0-9]{64}$/.test(h.trim()) ? h.trim() : null)
}


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
function getModelStatus(modelId, scannedModels, modelScores, aiSignatures, t) {
  const wasRequested = Array.isArray(scannedModels) && scannedModels.includes(modelId)
  const nr = t?.('pdf.not_requested') || 'Not Requested'
  const na = t?.('pdf.not_applicable') || 'N/A'
  if (!wasRequested) return nr

  if (modelId === 'type') {
    if (!aiSignatures) return na
    const parts = []
    const mex = t?.('pdf.missing_exif') || 'Missing EXIF'
    if (aiSignatures.missingExif) parts.push(mex)
    if (aiSignatures.suspiciousResolution) parts.push(`${t?.('pdf.meta_resolution') || 'Resolution'}: ${aiSignatures.suspiciousResolution}`)
    if (aiSignatures.softwareTags?.length) parts.push(`AI tags: ${aiSignatures.softwareTags.join(', ')}`)
    return parts.length ? parts.join('; ') : (t?.('pdf.verified') || 'Verified')
  }

  const key = modelId === 'genai' ? 'ai_generated' : modelId === 'deepfake' ? 'deepfake' : modelId === 'quality' ? 'quality' : null
  if (!key || !modelScores) return na
  const score = toDisplayScore(modelScores[key])
  return score ?? na
}

/**
 * Get display value for a video analysis model in the breakdown.
 * Maps: genai → ai_generated, deepfake → deepfake, voice_clone → voiceCloneReasoning, lip_sync → lipSyncIntegrity.
 */
/**
 * Video scannedModels from API: genai, deepfake, voice_clone, lip_sync.
 * temporal_ai + frame_integrity both map to genai.
 */
function getVideoModelStatus(modelId, scannedModels, modelScores, metadata, t) {
  const wasRequested = Array.isArray(scannedModels) && (
    scannedModels.includes(modelId) ||
    (modelId === 'genai' && scannedModels.some((m) => ['genai', 'temporal_ai', 'frame_integrity'].includes(m)))
  )
  const nr = t?.('pdf.not_requested') || 'Not Requested'
  const na = t?.('pdf.not_applicable') || 'N/A'
  if (!wasRequested) return nr

  if (modelId === 'voice_clone') {
    const v = metadata?.audioAnalysis?.voiceCloneReasoning ?? modelScores?.voice_clone_reasoning
    return (typeof v === 'string' && v.trim()) ? v : na
  }
  if (modelId === 'lip_sync') {
    const v = metadata?.lipSyncIntegrity ?? modelScores?.lip_sync_integrity
    return toDisplayScore(v) ?? na
  }
  const key = modelId === 'genai' ? 'ai_generated' : modelId === 'deepfake' ? 'deepfake' : null
  if (!key || !modelScores) return na
  const score = toDisplayScore(modelScores[key])
  return score ?? na
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
    language,
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
  doc.text(toPdfSafe(t?.('pdf.report_title') || 'Media Verification Report'), margin, y)
  y += 30

  // Divider
  doc.setFillColor(DARK_BLUE)
  doc.rect(margin, y, pageWidth - margin * 2, 2, 'F')
  y += 25

  // Scan details – use language for date format (e.g. 'ro', 'en')
  const locale = language ? (language.startsWith('ro') ? 'ro-RO' : language.startsWith('en') ? 'en-US' : language) : undefined
  const dateFormatted = new Date().toLocaleString(locale, {
    dateStyle: 'long',
    timeStyle: 'medium',
  })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_GRAY)
  doc.text(toPdfSafe(t?.('pdf.file_name') || 'File Name:'), margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(fileName || '—', margin + 90, y)
  y += 20

  const cleanHash = sanitizeFileHash(fileHash)
  if (cleanHash) {
    doc.setFont('helvetica', 'bold')
    doc.text(toPdfSafe(t?.('pdf.file_hash') || 'File Hash (SHA-256):'), margin, y)
    y += 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const hashLines = doc.splitTextToSize(cleanHash, pageWidth - margin * 2)
    doc.text(hashLines, margin, y)
    doc.setFontSize(11)
    y += hashLines.length * 10 + 14
  }

  doc.setFont('helvetica', 'bold')
  doc.text(toPdfSafe(t?.('pdf.date_time') || 'Date & Time:'), margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dateFormatted, margin + 90, y)
  y += 28

  // Verdict section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_BLUE)
  doc.text(toPdfSafe(t?.('pdf.verdict') || 'Verdict'), margin, y)
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
    doc.text(toPdfSafe(t?.('pdf.credibility_meter') || 'Credibility Meter (Fake News Detection)'), margin, y)
    y += 16
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(DARK_GRAY)
    const scoreLabel = toPdfSafe(t?.('pdf.credibility_score') || 'Score')
    const scoreVal = metadata.credibility.error
      ? toPdfSafe(t?.('pdf.credibility_unavailable') || 'N/A')
      : `${metadata.credibility.score}%`
    doc.text(`${scoreLabel}: ${scoreVal}`, margin, y)
    y += 14
    if (metadata.credibility.reasoning && !metadata.credibility.error) {
      const credLines = doc.splitTextToSize(toPdfSafe(metadata.credibility.reasoning), pageWidth - margin * 2)
      doc.text(credLines, margin, y)
      y += credLines.length * 12
    }
    if (metadata.credibility.redFlags?.length > 0 && !metadata.credibility.error) {
      y += 8
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(180, 0, 0)
      doc.text(toPdfSafe(t?.('verdict.fact_check_results') || 'Fact-Check Results'), margin, y)
      y += 12
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(DARK_GRAY)
      for (const flag of metadata.credibility.redFlags) {
        const flagLines = doc.splitTextToSize(toPdfSafe(flag), pageWidth - margin * 2 - 8)
        doc.text(flagLines, margin + 4, y)
        y += flagLines.length * 10 + 4
      }
      y += 12
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
    doc.text(toPdfSafe(t?.('pdf.ai_expert') || 'AI Expert Interpretation (DeepSeek Analyst)'), margin, y)
    y += 16
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(DARK_GRAY)
    const lines = doc.splitTextToSize(toPdfSafe(summary), pageWidth - margin * 2)
    doc.text(lines, margin, y)
    y += lines.length * 14 + 20
  }

  // Detection signals
  const signals = getDetectionSignals(aiSignatures, t)
  if (signals.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK_BLUE)
    doc.text(toPdfSafe(t?.('pdf.detection_signals') || 'Detection Signals'), margin, y)
    y += 20

    autoTable(doc, {
      startY: y,
      head: [[toPdfSafe(t?.('pdf.signal_column') || 'Signal')]],
      body: signals.map((s) => [toPdfSafe(s)]),
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
  doc.text(toPdfSafe(t?.('pdf.analysis_breakdown') || 'Analysis Breakdown'), margin, y)
  y += 20

  const tval = (k, d) => toPdfSafe(t?.(k) || d)
  const modelRows = isVideo
    ? [
        [tval('pdf.analysis_temporal_ai', 'Temporal AI Consistency'), getVideoModelStatus('genai', scannedModels, modelScores, metadata, t)],
        [tval('pdf.analysis_video_deepfake', 'Video Deepfake Detection'), getVideoModelStatus('deepfake', scannedModels, modelScores, metadata, t)],
        [tval('pdf.analysis_frame_integrity', 'Frame Integrity'), getVideoModelStatus('genai', scannedModels, modelScores, metadata, t)],
        [tval('pdf.analysis_voice_clone', 'Voice Clone Detection'), getVideoModelStatus('voice_clone', scannedModels, modelScores, metadata, t)],
        [tval('pdf.analysis_lip_sync', 'Lip-Sync Integrity'), getVideoModelStatus('lip_sync', scannedModels, modelScores, metadata, t)],
      ]
    : [
        [tval('pdf.analysis_deepfake', 'Deepfake Detection'), getModelStatus('deepfake', scannedModels, modelScores, aiSignatures, t)],
        [tval('pdf.analysis_genai', 'AI Pixel Analysis'), getModelStatus('genai', scannedModels, modelScores, aiSignatures, t)],
        [tval('pdf.analysis_metadata', 'Metadata Check'), getModelStatus('type', scannedModels, modelScores, aiSignatures, t)],
        [tval('pdf.analysis_quality', 'Image Quality'), getModelStatus('quality', scannedModels, modelScores, aiSignatures, t)],
      ]
  autoTable(doc, {
    startY: y,
    head: [[toPdfSafe(t?.('pdf.analysis_type') || 'Analysis Type'), toPdfSafe(t?.('pdf.status') || 'Status')]],
    body: modelRows.map(([a, b]) => [a, typeof b === 'string' ? toPdfSafe(b) : b]),
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
    doc.text(toPdfSafe(isVideo ? (t?.('pdf.video_metadata') || 'Video Metadata') : (t?.('pdf.file_metadata') || 'File Metadata')), margin, y)
    y += 20

    const mt = (k, d) => toPdfSafe(t?.(k) || d)
    const metaRows = []
    if (metadata?.fileType || metadata?.extension) {
      metaRows.push([mt('pdf.meta_type', 'Type'), metadata.fileType || metadata.extension || '—'])
    }
    if (metadata?.sizeFormatted || metadata?.size != null) {
      metaRows.push([mt('pdf.meta_size', 'Size'), metadata.sizeFormatted || `${metadata.size ?? 0} B`])
    }
    if (!isVideo && metadata?.resolution) {
      metaRows.push([mt('pdf.meta_resolution', 'Resolution'), metadata.resolution])
    }
    if (!isVideo && metadata?.createdAt) {
      metaRows.push([mt('pdf.meta_created', 'Created'), String(metadata.createdAt)])
    }
    if (isVideo) {
      if (metadata?.duration != null) metaRows.push([mt('pdf.meta_duration', 'Duration'), String(metadata.duration)])
      if (metadata?.resolution) metaRows.push([mt('pdf.meta_resolution', 'Resolution'), String(metadata.resolution)])
      if (metadata?.frameRate != null) metaRows.push([mt('pdf.meta_frame_rate', 'Frame Rate'), `${metadata.frameRate} fps`])
      metaRows.push([mt('pdf.meta_frames_analyzed', 'Frames Analyzed'), metadata?.framesAnalyzed != null ? String(metadata.framesAnalyzed) : '—'])
      const am = metadata?.analysisMethod === 'native_video' ? mt('pdf.analysis_method_native', 'Native Video (Sequential)') : metadata?.analysisMethod === 'frame_based' ? mt('pdf.analysis_method_frame', 'Frame-Based (Fast)') : '—'
      metaRows.push([mt('pdf.meta_analysis_method', 'Analysis Method'), am])
      if (metadata?.lipSyncIntegrity != null) {
        metaRows.push([mt('pdf.meta_lip_sync', 'Lip-Sync Integrity'), toDisplayScore(metadata.lipSyncIntegrity) ?? '—'])
      }
      if (metadata?.audioAnalysis?.voiceCloneReasoning) {
        metaRows.push([mt('pdf.meta_voice_clone', 'Voice Clone'), 'DeepSeek (metadata + lip-sync)'])
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
