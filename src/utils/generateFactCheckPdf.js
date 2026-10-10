import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const DARK_BLUE = '#1e3a5f'
const DARK_GRAY = '#374151'
const LIGHT_GRAY = '#6b7280'
const COLORS = {
  supported: '#047857',
  contested: '#b45309',
  refuted: '#b91c1c',
  unverifiable: '#6b7280',
  no_claims: '#6b7280',
}

/** Helvetica lacks Romanian diacritics; keep the output readable. */
function safe(str) {
  if (typeof str !== 'string') return str == null ? '' : String(str)
  return str
    .replace(/ș/g, 's')
    .replace(/Ș/g, 'S')
    .replace(/ț/g, 't')
    .replace(/Ț/g, 'T')
    .replace(/ă/g, 'a')
    .replace(/Ă/g, 'A')
    .replace(/â/g, 'a')
    .replace(/Â/g, 'A')
    .replace(/î/g, 'i')
    .replace(/Î/g, 'I')
}

/**
 * PDF report for a fact-check result (see backend/services/factcheck.js).
 * @param {{ result: object, t: Function, language?: string }} opts
 */
export function generateFactCheckPdf({ result, t, language }) {
  const tv = (k, d, o) => safe(t?.(k, o) || d)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 50
  const width = pageWidth - margin * 2
  let y = 50

  const ensure = (needed) => {
    if (y + needed > pageHeight - 60) {
      doc.addPage()
      y = 50
    }
  }
  const paragraph = (text, size = 10, color = DARK_GRAY, gap = 12) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(color)
    const lines = doc.splitTextToSize(safe(text), width)
    ensure(lines.length * (size + 3))
    doc.text(lines, margin, y)
    y += lines.length * (size + 3) + gap
  }
  const heading = (text, size = 12) => {
    ensure(size + 16)
    doc.setFontSize(size)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK_BLUE)
    doc.text(safe(text), margin, y)
    y += size + 8
  }

  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK_BLUE)
  doc.text('VerifEye', margin, y)
  y += 18
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(LIGHT_GRAY)
  doc.text(tv('factcheck.pdf_title', 'Fact-check report'), margin, y)
  y += 24
  doc.setFillColor(DARK_BLUE)
  doc.rect(margin, y, width, 2, 'F')
  y += 22

  const locale = language?.startsWith('ro') ? 'ro-RO' : language?.startsWith('en') ? 'en-US' : language
  const date = new Date(result.scannedAt || Date.now()).toLocaleString(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  paragraph(`${tv('pdf.date_time', 'Date & Time:')} ${date}`, 10, DARK_GRAY, 6)

  const verdict = result.verdict ?? 'unverifiable'
  heading(tv('factcheck.overall', 'Overall verdict'))
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS[verdict] ?? LIGHT_GRAY)
  doc.text(tv(`factcheck.verdict_${verdict}`, verdict), margin, y)
  y += 24
  if (result.confidence != null && result.claims?.length) {
    paragraph(
      tv('factcheck.confidence', `Confidence ${result.confidence}%`, { value: result.confidence }),
      10,
      LIGHT_GRAY,
      6
    )
  }
  if (result.summary) paragraph(result.summary, 10, DARK_GRAY, 14)

  const post = result.post ?? {}
  if (post.text) {
    heading(tv('factcheck.post_title', 'The post'), 11)
    const meta = [post.author, post.platform, post.date].filter(Boolean).join(' · ')
    if (meta) paragraph(meta, 9, LIGHT_GRAY, 4)
    paragraph(post.text.slice(0, 1500), 10, DARK_GRAY, 14)
  }

  const sourceById = new Map((result.sources ?? []).map((s) => [s.id, s]))
  for (const [i, c] of (result.claims ?? []).entries()) {
    heading(`${i + 1}. ${c.text}`, 11)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(COLORS[c.verdict] ?? LIGHT_GRAY)
    ensure(16)
    doc.text(
      `${tv(`factcheck.verdict_${c.verdict}`, c.verdict)}${c.verdict !== 'unverifiable' && c.confidence != null ? `  (${c.confidence}%)` : ''}`,
      margin,
      y
    )
    y += 14
    if (c.explanation) paragraph(c.explanation, 10, DARK_GRAY, 6)
    const refs = (c.sourceIds ?? []).map((id) => sourceById.get(id)).filter(Boolean)
    if (refs.length) {
      ensure(40)
      autoTable(doc, {
        startY: y,
        head: [
          [tv('factcheck.pdf_source', 'Source'), tv('factcheck.pdf_kind', 'Kind'), tv('factcheck.pdf_link', 'Link')],
        ],
        body: refs.map((s) => [
          safe(`${s.publisher || s.site || ''}${s.title ? ` — ${s.title}` : ''}${s.rating ? ` (${s.rating})` : ''}`),
          s.kind === 'factcheck' ? tv('factcheck.source_factcheck', 'Fact-check') : 'Web',
          s.url,
        ]),
        theme: 'striped',
        headStyles: { fillColor: DARK_BLUE, textColor: '#fff', fontStyle: 'bold' },
        bodyStyles: { textColor: DARK_GRAY, fontSize: 8 },
        columnStyles: { 0: { cellWidth: 190 }, 1: { cellWidth: 60 }, 2: { cellWidth: width - 250 } },
        margin: { left: margin },
        tableWidth: width,
      })
      y = doc.lastAutoTable.finalY + 14
    } else {
      paragraph(tv('factcheck.no_sources', 'No source found for this claim.'), 9, LIGHT_GRAY, 10)
    }
  }

  if (result.skippedClaims?.length) {
    heading(tv('factcheck.skipped_title', 'Not checkable'), 11)
    for (const c of result.skippedClaims) paragraph(`• ${c.text}${c.reason ? ` (${c.reason})` : ''}`, 9, LIGHT_GRAY, 4)
    y += 8
  }

  doc.setFontSize(8)
  doc.setTextColor(LIGHT_GRAY)
  const disclaimer = doc.splitTextToSize(
    tv(
      'factcheck.disclaimer',
      'Verdicts rest only on the sources listed. A claim without sources is unverifiable, not false. Check the sources yourself before sharing.'
    ),
    width
  )
  ensure(disclaimer.length * 10 + 30)
  doc.text(disclaimer, margin, pageHeight - 30 - disclaimer.length * 10)
  doc.text(
    `VerifEye v${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'} - ${tv('pdf.footer', 'This report is for informational purposes only.')}`,
    margin,
    pageHeight - 20
  )
  return doc
}
