import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import App from '@/App.vue'

describe('App', () => {
  it('renders the placeholder heading', () => {
    render(App)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Kolonie Workplace')
  })

  it('renders a placeholder and nothing that a later issue owns', () => {
    const { container } = render(App)

    expect(container.querySelector('nav')).toBeNull()
    expect(container.querySelector('form')).toBeNull()
    expect(screen.queryByTestId('work-item')).toBeNull()
  })
})
