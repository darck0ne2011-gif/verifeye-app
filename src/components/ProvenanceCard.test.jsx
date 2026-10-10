import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProvenanceCard from './ProvenanceCard'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) =>
      opts?.name
        ? `${key}:${opts.name}`
        : opts?.defaultValue && key.startsWith('provenance.action_')
          ? opts.defaultValue
          : key,
    i18n: { language: 'en' },
  }),
}))

const signedAi = {
  c2pa: {
    supported: true,
    present: true,
    validation: 'valid',
    claimGenerator: 'Adobe Firefly 3.0',
    signer: { issuer: 'Adobe Inc.' },
    signedAt: '2026-01-02T03:04:05Z',
    sourceType: 'trainedAlgorithmicMedia',
    aiGenerated: true,
    actions: [{ action: 'created', softwareAgent: 'Adobe Firefly', digitalSourceType: 'trainedAlgorithmicMedia' }],
    ingredients: 0,
  },
  metadata: { hints: [] },
  generator: { id: 'firefly', label: 'Adobe Firefly', source: 'c2pa', signed: true },
}

describe('ProvenanceCard', () => {
  it('shows a signed AI manifest with its generator, signer and evidence', () => {
    render(<ProvenanceCard provenance={signedAi} evidence={['c2pa_ai']} />)
    expect(screen.getByText('provenance.status_valid')).toBeInTheDocument()
    expect(screen.getByText('provenance.evidence_c2pa_ai')).toBeInTheDocument()
    expect(screen.getByText('provenance.generator_signed:Adobe Firefly')).toBeInTheDocument()
    expect(screen.getByText('Adobe Firefly 3.0')).toBeInTheDocument()
    expect(screen.getByText('Adobe Inc.')).toBeInTheDocument()
    expect(screen.getByText('provenance.source_trainedAlgorithmicMedia')).toBeInTheDocument()
  })

  it('explains missing credentials differently for screenshots', () => {
    const none = { c2pa: { supported: true, present: false }, metadata: { hints: [] }, generator: null }
    const { rerender } = render(<ProvenanceCard provenance={none} source="file" />)
    expect(screen.getByText('provenance.status_none')).toBeInTheDocument()
    expect(screen.getByText('provenance.none_hint')).toBeInTheDocument()
    rerender(<ProvenanceCard provenance={none} source="screenshot" />)
    expect(screen.getByText('provenance.none_screenshot')).toBeInTheDocument()
  })

  it('lists unsigned metadata traces and flags tampering', () => {
    const prov = {
      c2pa: { supported: true, present: true, validation: 'tampered', actions: [] },
      metadata: {
        hints: [{ generatorId: 'stable_diffusion', generatorLabel: 'Stable Diffusion', field: 'png:parameters' }],
      },
      generator: { id: 'stable_diffusion', label: 'Stable Diffusion', source: 'metadata', signed: false },
    }
    render(<ProvenanceCard provenance={prov} evidence={['metadata_ai']} />)
    expect(screen.getByText('provenance.status_tampered')).toBeInTheDocument()
    expect(screen.getByText('provenance.tampered_hint')).toBeInTheDocument()
    expect(screen.getByText('provenance.generator_declared:Stable Diffusion')).toBeInTheDocument()
    expect(screen.getByText(/Stable Diffusion/, { selector: 'li' })).toBeInTheDocument()
  })

  it('renders nothing without provenance data', () => {
    const { container } = render(<ProvenanceCard provenance={null} />)
    expect(container.firstChild).toBeNull()
  })
})
