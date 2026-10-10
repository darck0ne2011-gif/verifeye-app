import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FactCheckScreen from './FactCheckScreen'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) =>
      opts && 'count' in opts ? `${key}:${opts.count}` : opts?.value != null ? `${key}:${opts.value}` : key,
    i18n: { language: 'en' },
  }),
}))
vi.mock('../native/verifeye', () => ({ exportNativeFile: async () => false }))

const result = {
  mediaCategory: 'post',
  verdict: 'refuted',
  confidence: 88,
  summary: 'The central claim of the post is false.',
  post: { text: 'BREAKING: the mayor resigned today!', author: 'Ion P.', platform: 'Facebook', fromScreenshot: true },
  claims: [
    {
      id: 'c1',
      text: 'The mayor resigned on 3 March 2026.',
      verdict: 'refuted',
      confidence: 88,
      explanation: 'A published fact-check found no resignation.',
      sourceIds: ['s1'],
    },
    { id: 'c2', text: 'Turnout was 40%.', verdict: 'unverifiable', confidence: 0, explanation: null, sourceIds: [] },
  ],
  skippedClaims: [{ text: 'Worst government ever.', reason: 'opinion' }],
  sources: [
    {
      id: 's1',
      kind: 'factcheck',
      publisher: 'Factual.ro',
      url: 'https://www.factual.ro/x',
      title: 'False: no resignation',
      rating: 'False',
      reviewDate: '2026-03-10',
    },
  ],
  providers: { factcheckApi: true, webSearch: 'tavily' },
  warnings: ['link_only'],
}

describe('FactCheckScreen', () => {
  it('shows the overall verdict, each claim with its verdict and sources, and warnings', () => {
    render(<FactCheckScreen result={result} canDownloadPdf />)
    expect(screen.getByText('factcheck.verdict_refuted', { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByText('The central claim of the post is false.')).toBeInTheDocument()
    expect(screen.getByText('factcheck.claims_title:2')).toBeInTheDocument()
    expect(screen.getByText('The mayor resigned on 3 March 2026.')).toBeInTheDocument()
    expect(screen.getByText('A published fact-check found no resignation.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'False: no resignation' })
    expect(link).toHaveAttribute('href', 'https://www.factual.ro/x')
    expect(screen.getByText('factcheck.verdict_unverifiable')).toBeInTheDocument()
    expect(screen.getByText('factcheck.no_sources')).toBeInTheDocument()
    expect(screen.getByText(/Worst government ever/)).toBeInTheDocument()
    expect(screen.getByText(/factcheck.warning_link_only/)).toBeInTheDocument()
    expect(screen.getByText('Ion P. · Facebook')).toBeInTheDocument()
  })

  it('explains when nothing could be checked', () => {
    render(<FactCheckScreen result={{ ...result, verdict: 'no_claims', claims: [], sources: [], warnings: [] }} />)
    expect(screen.getByText('factcheck.verdict_no_claims', { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByText('factcheck.no_claims_hint')).toBeInTheDocument()
  })

  it('shows the error state', () => {
    render(<FactCheckScreen result={null} error="Service down" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Service down')
  })
})
