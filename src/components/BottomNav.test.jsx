import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BottomNav from './BottomNav'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }),
}))

describe('BottomNav', () => {
  it('renders every tab with its icon and marks the active route', () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <BottomNav />
      </MemoryRouter>
    )
    for (const key of ['nav.home', 'nav.history', 'nav.scan_settings', 'nav.upgrade']) {
      expect(screen.getByText(key)).toBeInTheDocument()
    }
    expect(document.querySelectorAll('svg')).toHaveLength(4)
    expect(screen.getByText('nav.history').closest('a')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('nav.home').closest('a')).not.toHaveAttribute('aria-current')
  })
})
