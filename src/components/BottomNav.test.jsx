import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BottomNav from './BottomNav'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }),
}))

describe('BottomNav', () => {
  it('renders every tab with its icon and switches tabs', () => {
    const onTabChange = vi.fn()
    render(<BottomNav activeTab="home" onTabChange={onTabChange} />)

    for (const key of ['nav.home', 'nav.history', 'nav.scan_settings', 'nav.upgrade']) {
      expect(screen.getByText(key)).toBeInTheDocument()
    }
    // One SVG icon per tab.
    expect(document.querySelectorAll('svg')).toHaveLength(4)

    fireEvent.click(screen.getByText('nav.history'))
    expect(onTabChange).toHaveBeenCalledWith('history')
  })
})
