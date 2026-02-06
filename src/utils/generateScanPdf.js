import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const DARK_BLUE = '#1e3a5f'
const ACCENT_BLUE = '#2563eb'
const DARK_GRAY = '#374151'
const LIGHT_GRAY = '#6b7280'
const VERDICT_REAL = '#047857'
const VERDICT_FAKE = '#b91c1c'

const MODEL_LABELS = {
  ai_generated: 'AI Pixel Analysis',
  deepfake: 'Deepfake Detection',
  quality: 'Image Quality',
  type: 'Metadata Check',
}

/**
 * Convert raw model score to display percentage (matches UI: RealTimeAnalysis uses raw * 100).
 * API returns 0-1 for ai_generated, deepfake, quality. Returns 'N/A' for null/undefined.
 */
function toDisplayScore(raw) {
  if (raw == null || raw === undefined) return 'N/A'
  const n = Number(raw)
  if (Number.isNaN(n)) return 'N/A'
  if (n <= 1 && n >= 0) return `${Math.round(n * 100)}%`
  return `${Math.round(n)}%`
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
 * @param {object} [opts.metadata] - File metadata
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

  // Model scores – use exact same winningScore logic as UI (0-1 → display %)
  if (modelScores && typeof modelScores === 'object' && Object.keys(modelScores).length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK_BLUE)
    doc.text('Analysis Breakdown', margin, y)
    y += 20

    const modelRows = []
    for (const key of ['ai_generated', 'deepfake', 'quality']) {
      const raw = modelScores[key]
      const label = MODEL_LABELS[key] || key
      modelRows.push([label, toDisplayScore(raw)])
    }
    if (modelRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Model', 'Score']],
        body: modelRows,
        theme: 'striped',
        headStyles: { fillColor: DARK_BLUE, textColor: '#fff', fontStyle: 'bold' },
        bodyStyles: { textColor: DARK_GRAY, fontSize: 10 },
        columnStyles: {
          0: { cellWidth: pageWidth - margin * 2 - 80 },
          1: { cellWidth: 70, halign: 'right' },
        },
        margin: { left: margin },
        tableWidth: pageWidth - margin * 2,
      })
      y = doc.lastAutoTable.finalY + 20
    }
  }

  // Metadata snippet
  if (metadata && (metadata.fileType || metadata.sizeFormatted || metadata.extension)) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK_BLUE)
    doc.text('File Metadata', margin, y)
    y += 20

    const metaRows = []
    if (metadata.fileType || metadata.extension) {
      metaRows.push(['Type', metadata.fileType || metadata.extension || '—'])
    }
    if (metadata.sizeFormatted || metadata.size) {
      metaRows.push(['Size', metadata.sizeFormatted || `${metadata.size || 0} B`])
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
