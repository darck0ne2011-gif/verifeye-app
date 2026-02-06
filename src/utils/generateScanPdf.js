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
    const hasAnomalies = aiSignatures.missingExif || aiSignatures.suspiciousResolution || (aiSignatures.softwareTags?.length > 0)
    return hasAnomalies ? 'Anomalies Detected' : 'Verified'
  }

  const key = modelId === 'genai' ? 'ai_generated' : modelId === 'deepfake' ? 'deepfake' : modelId === 'quality' ? 'quality' : null
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
    t,
  } = opts

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
  doc.text('Forensic Media Verification Report', margin, y)
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
  doc.text('File Name:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(fileName || '—', margin + 90, y)
  y += 20

  if (fileHash) {
    doc.setFont('helvetica', 'bold')
    doc.text('File Hash (SHA-256):', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(fileHash, margin + 110, y, { maxWidth: pageWidth - margin - 120 })
    doc.setFontSize(11)
    y += 24
  }

  doc.setFont('helvetica', 'bold')
  doc.text('Date & Time:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(dateFormatted, margin + 90, y)
  y += 28

  // Verdict section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_BLUE)
  doc.text('Verdict', margin, y)
  y += 22

  const resultColor = status === 'REAL' ? VERDICT_REAL : VERDICT_FAKE
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(resultColor)
  doc.text(status, margin, y)
  doc.text(`${score}%`, margin + 70, y)
  y += 40

  // Detection signals
  const signals = getDetectionSignals(aiSignatures, t)
  if (signals.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK_BLUE)
    doc.text('Detection Signals', margin, y)
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

  // Analysis Breakdown – all 4 types with status logic
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_BLUE)
  doc.text('Analysis Breakdown', margin, y)
  y += 20

  const isVideo = metadata?.mediaCategory === 'video'
  const hasVideoModels = Array.isArray(scannedModels) && scannedModels.some((m) => ['genai', 'deepfake'].includes(m))
  const modelRows = isVideo && hasVideoModels
    ? [
        ['AI Detection Across Frames', (() => {
          const ag = modelScores?.ai_generated != null ? Number(modelScores.ai_generated) : 0
          const df = modelScores?.deepfake != null ? Number(modelScores.deepfake) : 0
          const consolidated = Math.max(ag, df)
          return toDisplayScore(consolidated) ?? 'Not Applicable'
        })()],
      ]
    : [
        ['AI Pixel Analysis', getModelStatus('genai', scannedModels, modelScores, aiSignatures)],
        ['Deepfake Detection', getModelStatus('deepfake', scannedModels, modelScores, aiSignatures)],
        ['Metadata Check', getModelStatus('type', scannedModels, modelScores, aiSignatures)],
        ['Image Quality', getModelStatus('quality', scannedModels, modelScores, aiSignatures)],
      ]
  autoTable(doc, {
    startY: y,
    head: [['Analysis Type', 'Status']],
    body: modelRows,
    theme: 'striped',
    headStyles: { fillColor: DARK_BLUE, textColor: '#fff', fontStyle: 'bold' },
    bodyStyles: { textColor: DARK_GRAY, fontSize: 10 },
    columnStyles: {
      0: { cellWidth: pageWidth - margin * 2 - 100 },
      1: { cellWidth: 100, halign: 'right' },
    },
    margin: { left: margin },
    tableWidth: pageWidth - margin * 2,
  })
  y = doc.lastAutoTable.finalY + 20

  // Metadata snippet (image or video)
  if (metadata && (metadata.fileType || metadata.sizeFormatted || metadata.extension)) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK_BLUE)
    doc.text(isVideo ? 'Video Metadata' : 'File Metadata', margin, y)
    y += 20

    const metaRows = []
    if (metadata.fileType || metadata.extension) {
      metaRows.push(['Type', metadata.fileType || metadata.extension || '—'])
    }
    if (metadata.sizeFormatted || metadata.size) {
      metaRows.push(['Size', metadata.sizeFormatted || `${metadata.size || 0} B`])
    }
    if (isVideo) {
      if (metadata.duration != null) metaRows.push(['Duration', String(metadata.duration)])
      if (metadata.resolution) metaRows.push(['Resolution', String(metadata.resolution)])
      if (metadata.frameRate != null) metaRows.push(['Frame Rate', `${metadata.frameRate} fps`])
      if (metadata.framesAnalyzed != null) metaRows.push(['Frames Analyzed', String(metadata.framesAnalyzed)])
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
