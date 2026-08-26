import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import App from '@/App.vue'

describe('App', () => {
  it('renders the workplace shell', () => {
    render(App)

    expect(screen.getByTestId('sidebar')).toBeTruthy()
    expect(screen.getByTestId('topbar')).toBeTruthy()
    expect(screen.getByTestId('board-header')).toBeTruthy()
    expect(screen.getByRole('tabpanel')).toBeTruthy()
  })

  it('renders placeholder shell content and no later-issue data surface', () => {
    const { container } = render(App)

    expect(screen.getByRole('heading', { level: 1 }).textContent?.trim()).toBe('Work board')
    expect(container.querySelector('form')).toBeNull()
    expect(screen.queryByTestId('work-item')).toBeNull()
  })
})
