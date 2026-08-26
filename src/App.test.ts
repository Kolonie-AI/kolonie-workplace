import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import App from '@/App.vue'

describe('App', () => {
  it('opens signed out, with the sign-in offer and no board chrome', () => {
    render(App)

    expect(screen.getByTestId('signed-out')).toBeTruthy()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('topbar')).toBeNull()
    expect(screen.queryByTestId('board-header')).toBeNull()
    expect(screen.queryByRole('tabpanel')).toBeNull()
  })

  it('renders the workplace shell once a human is signed in', async () => {
    render(App)

    await fireEvent.click(screen.getByRole('button', { name: /Fictional Human Wren/ }))

    expect(screen.getByTestId('sidebar')).toBeTruthy()
    expect(screen.getByTestId('topbar')).toBeTruthy()
    expect(screen.getByTestId('board-header')).toBeTruthy()
    expect(screen.getByRole('tabpanel')).toBeTruthy()
    expect(screen.getByTestId('signed-in-human').textContent).toContain('Fictional Human Wren')
  })

  it('renders placeholder shell content and no later-issue data surface', async () => {
    const { container } = render(App)

    await fireEvent.click(screen.getByRole('button', { name: /Fictional Human Wren/ }))

    expect(screen.getByRole('heading', { level: 1 }).textContent?.trim()).toBe('Work board')
    expect(container.querySelector('form')).toBeNull()
    expect(screen.queryByTestId('work-item')).toBeNull()
  })
})
