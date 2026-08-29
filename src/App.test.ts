import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import App from '@/App.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'

/**
 * Application tests exercise the shell with an injected fixture session. #2
 * removed that session from application composition; importing it here is the
 * deliberate seam, not a route back into a production build. The production
 * path has its own test, which asserts the composition point cannot import or
 * return this implementation.
 */
function renderFixtureApp() {
  return render(App, {
    props: { session: createFixtureWorkplaceSession() },
  })
}

describe('App', () => {
  it('opens signed out, with the sign-in offer and no board chrome', () => {
    renderFixtureApp()

    expect(screen.getByTestId('signed-out')).toBeTruthy()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('topbar')).toBeNull()
    expect(screen.queryByTestId('board-header')).toBeNull()
    expect(screen.queryByRole('tabpanel')).toBeNull()
  })

  it('renders the workplace shell once a human is signed in', async () => {
    renderFixtureApp()

    await fireEvent.click(screen.getByRole('button', { name: /Fictional Human Wren/ }))

    expect(screen.getByTestId('sidebar')).toBeTruthy()
    expect(screen.queryByTestId('topbar')).toBeNull()
    expect(screen.getByTestId('board-header')).toBeTruthy()
    expect(screen.getByRole('tabpanel')).toBeTruthy()
    expect(screen.getByTestId('signed-in-human').textContent).toContain('Fictional Human Wren')
  })

  it('renders placeholder shell content and no later-issue data surface', async () => {
    const { container } = renderFixtureApp()

    await fireEvent.click(screen.getByRole('button', { name: /Fictional Human Wren/ }))

    expect(screen.queryByRole('heading', { name: 'Work board' })).toBeNull()
    expect(screen.getByTestId('board-header')).toBeTruthy()
    expect(container.querySelector('form')).toBeNull()
    expect(screen.queryByTestId('work-item')).toBeNull()
  })
})
