import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { ref } from 'vue'
import type { Human } from '@/domain/workplace'
import {
  FIXTURE_HUMANS,
  fixtureBoards,
  fixtureHumans,
  fixtureWorkItems,
} from '@/fixtures/catalogue'
import type { TaskGateway } from '@/gateway/task-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { WorkplaceForbidden, WorkplaceUnauthorized } from '@/gateway/workplace-http-errors'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import SessionGate from '@/session/SessionGate.vue'
import SignedInHuman from '@/session/SignedInHuman.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

function renderGate(session: WorkplaceSession, gateway: TaskGateway = createFixtureTaskGateway()) {
  return render(SessionGate, {
    global: { provide: { [WORKPLACE_SESSION]: session, [TASK_GATEWAY]: gateway } },
  })
}

describe('SessionGate — signed out', () => {
  it('renders the sign-in offer and no board chrome at all', () => {
    renderGate(createFixtureWorkplaceSession())

    expect(screen.getByTestId('signed-out')).toBeTruthy()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('topbar')).toBeNull()
    expect(screen.queryByTestId('board-header')).toBeNull()
    expect(screen.queryByTestId('preview-data-indication')).toBeNull()
    expect(screen.queryByText(/Example data/)).toBeNull()
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
    expect(screen.queryByTestId('topbar')).toBeNull()
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

describe('SessionGate — live citizen selection', () => {
  function liveSession(agents: readonly { id: string; handle: string; status: string }[]): WorkplaceSession {
    const currentHuman = ref<Human | null>(null)
    const linkedAgents = ref(agents)
    return {
      currentHuman,
      linkedAgents,
      signIn: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
      switchCitizen: vi.fn(() => {
        currentHuman.value = null
      }),
      pickCitizen: vi.fn((citizenId: string) => {
        const citizen = agents.find((candidate) => candidate.id === citizenId)
        if (citizen !== undefined) {
          currentHuman.value = {
            id: citizen.id,
            name: citizen.handle,
            agentIds: [citizen.id],
          }
        }
      }),
    }
  }

  it('requires an explicit citizen pick before rendering the shell', async () => {
    const session = liveSession([{ id: 'agent-quill', handle: 'quill', status: 'citizen' }])
    renderGate(session)

    expect(screen.getByTestId('citizen-gate')).toBeTruthy()
    expect(screen.queryByTestId('sidebar')).toBeNull()

    await fireEvent.click(screen.getByRole('button', { name: /continue as quill/i }))

    expect(session.pickCitizen).toHaveBeenCalledWith('agent-quill')
    expect(screen.getByTestId('sidebar')).toBeTruthy()
  })

  it('switches a signed-in citizen, reloads boards, and uses the newly selected actor', async () => {
    const session = liveSession([
      { id: 'agent-quill', handle: 'quill', status: 'citizen' },
      { id: 'agent-marlow', handle: 'marlow', status: 'citizen' },
    ])
    const requests: string[] = []
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'listVisibleBoards').mockImplementation(async (humanId) => {
      requests.push(humanId)
      return []
    })
    renderGate(session, gateway)

    await fireEvent.click(screen.getByRole('button', { name: /continue as quill/i }))
    await screen.findByTestId('boards-empty')
    await fireEvent.click(screen.getByRole('button', { name: /switch citizen/i }))
    expect(screen.getByTestId('citizen-gate')).toBeTruthy()
    await fireEvent.click(screen.getByRole('button', { name: /continue as marlow/i }))
    await screen.findByTestId('boards-empty')

    expect(session.signOut).not.toHaveBeenCalled()
    expect(requests).toContain('agent-quill')
    expect(requests.at(-1)).toBe('agent-marlow')
  })

  it('shows an honest empty state when the human operates nobody', () => {
    renderGate(liveSession([]))

    expect(screen.getByTestId('no-linked-citizens').textContent).toMatch(/operates nobody/i)
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('fixture-sign-in')).toBeNull()
  })
})

describe('SessionGate — live application failures', () => {
  function failedLiveSession(failure: 'unauthorized' | 'forbidden'): WorkplaceSession {
    return {
      currentHuman: ref<Human | null>(null),
      linkedAgents: ref(null),
      failure: ref(failure),
      signIn: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
    }
  }

  it('renders 401 as an actionable sign-in-again state', async () => {
    const session = failedLiveSession('unauthorized')
    renderGate(session)

    expect(screen.getByTestId('session-unauthorized').textContent).toMatch(/sign in again/i)
    expect(screen.queryByTestId('signed-out')).toBeNull()
    await fireEvent.click(screen.getByRole('button', { name: /sign in again/i }))
    expect(session.signIn).toHaveBeenCalledTimes(1)
  })

  it('renders origin 403 as deployment configuration, never sign-in or empty boards', () => {
    const session = failedLiveSession('forbidden')
    renderGate(session)

    expect(screen.getByTestId('session-forbidden').textContent).toMatch(/deployment|origin/i)
    expect(screen.queryByTestId('signed-out')).toBeNull()
    expect(screen.queryByTestId('boards-empty')).toBeNull()
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
  })

  it('preserves gateway 401 and 403 classes for the real composition path', () => {
    expect(new WorkplaceUnauthorized()).toBeInstanceOf(WorkplaceUnauthorized)
    expect(new WorkplaceForbidden()).toBeInstanceOf(WorkplaceForbidden)
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
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
    }

    render(SessionGate, {
      global: {
        provide: {
          [WORKPLACE_SESSION]: createFixtureWorkplaceSession(),
          [TASK_GATEWAY]: gateway,
        },
      },
    })

    expect(gateway.listVisibleBoards).not.toHaveBeenCalled()
    expect(gateway.getBoardItems).not.toHaveBeenCalled()
    expect(gateway.getItemDetail).not.toHaveBeenCalled()
  })
})
