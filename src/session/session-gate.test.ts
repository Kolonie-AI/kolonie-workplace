import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import {
  FIXTURE_HUMANS,
  fixtureBoards,
  fixtureHumans,
  fixtureWorkItems,
} from '@/fixtures/catalogue'
import type { TaskGateway } from '@/gateway/task-gateway'
import SessionGate from '@/session/SessionGate.vue'
import SignedInHuman from '@/session/SignedInHuman.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

function renderGate(session: WorkplaceSession) {
  return render(SessionGate, {
    global: { provide: { [WORKPLACE_SESSION]: session } },
  })
}

describe('SessionGate — signed out', () => {
  it('renders the sign-in offer and no board chrome at all', () => {
    renderGate(createFixtureWorkplaceSession())

    expect(screen.getByTestId('signed-out')).toBeTruthy()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('topbar')).toBeNull()
    expect(screen.queryByTestId('board-header')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('tabpanel')).toBeNull()
  })

  it('labels the picker as a development affordance and offers no credential entry', () => {
    const { container } = renderGate(createFixtureWorkplaceSession())

    expect(screen.getByTestId('fixture-sign-in').textContent).toMatch(/development/i)
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('input[type="password"]')).toBeNull()
    expect(container.querySelector('form')).toBeNull()
  })
})

describe('SessionGate — signed in', () => {
  it('renders the shell and names the human that was chosen', async () => {
    renderGate(createFixtureWorkplaceSession())

    await fireEvent.click(screen.getByRole('button', { name: /Fictional Human Ash/ }))

    expect(screen.queryByTestId('signed-out')).toBeNull()
    expect(screen.getByTestId('sidebar')).toBeTruthy()
    expect(screen.getByTestId('board-header')).toBeTruthy()
    expect(screen.getByTestId('signed-in-human').textContent).toContain('Fictional Human Ash')
    expect(screen.getByTestId('signed-in-human').textContent).not.toContain('Fictional Human Wren')
  })

  it('returns to the signed-out view when the human signs out', async () => {
    const session = createFixtureWorkplaceSession()
    renderGate(session)

    await fireEvent.click(screen.getByRole('button', { name: /Fictional Human Wren/ }))
    await fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(session.currentHuman.value).toBeNull()
    expect(screen.getByTestId('signed-out')).toBeTruthy()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('signed-in-human')).toBeNull()
  })

  it('swaps to the other human without a reload when a second human is picked', async () => {
    const session = createFixtureWorkplaceSession()
    renderGate(session)

    await fireEvent.click(screen.getByRole('button', { name: /Fictional Human Wren/ }))
    await fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await fireEvent.click(screen.getByRole('button', { name: /Fictional Human Ash/ }))

    expect(session.currentHuman.value?.id).toBe(FIXTURE_HUMANS.ash)
    expect(screen.getByTestId('signed-in-human').textContent).toContain('Fictional Human Ash')
  })
})

describe('SessionGate — rejection: no session at all', () => {
  it('renders the signed-out state rather than another human or a default human', () => {
    const { container } = render(SessionGate)

    expect(screen.getByTestId('signed-out')).toBeTruthy()
    expect(screen.queryByTestId('signed-in-human')).toBeNull()
    expect(screen.queryByTestId('fixture-sign-in')).toBeNull()

    for (const human of fixtureHumans) {
      expect(container.textContent).not.toContain(human.name)
    }

    for (const board of fixtureBoards) {
      expect(container.textContent).not.toContain(board.title)
    }

    for (const item of fixtureWorkItems) {
      expect(container.textContent).not.toContain(item.title)
    }
  })

  it('renders nothing at all from a component that needs a human', () => {
    const { container } = render(SignedInHuman)

    expect(container.textContent?.trim()).toBe('')
    expect(screen.queryByTestId('signed-in-human')).toBeNull()
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()

    for (const human of fixtureHumans) {
      expect(container.textContent).not.toContain(human.name)
    }
  })

  it('fetches no board data while signed out', () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(),
      getBoardItems: vi.fn(),
      getItemDetail: vi.fn(),
    }

    render(SessionGate, {
      global: {
        provide: {
          [WORKPLACE_SESSION]: createFixtureWorkplaceSession(),
          taskGateway: gateway,
        },
      },
    })

    expect(gateway.listVisibleBoards).not.toHaveBeenCalled()
    expect(gateway.getBoardItems).not.toHaveBeenCalled()
    expect(gateway.getItemDetail).not.toHaveBeenCalled()
  })
})
