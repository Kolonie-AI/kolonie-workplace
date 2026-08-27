import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import SessionGate from '@/session/SessionGate.vue'
import { createAuth0WorkplaceSession } from '@/session/auth0-workplace-session'
import {
  createColonyHumanDirectory,
  PREVIEW_HUMAN_ID,
} from '@/session/colony-human-directory'
import { WORKPLACE_SESSION } from '@/session/workplace-session'
import { fixtureHumans } from '@/fixtures/catalogue'

/**
 * The signed-in journey the deployed preview is meant to show, exercised through
 * the real chain: the Auth0 session, the configured directory from #39, and the
 * shell. Only the Auth0 SDK itself is a double, because the hosted login is a
 * browser redirect to a tenant and cannot run here.
 *
 * **Why this test exists.** #39's definition of done asks for a browser
 * verification against the deployed host. That host answers 502 until
 * `Kolonie-AI/kolonie-infra#243` deploys, so that item is unproven in this
 * change and is recorded as such rather than quietly dropped. This proves the
 * same chain at the seam a deploy would exercise: a real callback resolving
 * through the configured mapping, the sidebar, the Kanban, the `Example data`
 * label, and sign-out.
 *
 * The configured pair is fictional, exactly as everywhere else: the real values
 * arrive from the environment at build time and are written down nowhere.
 */
const CONFIGURED = {
  VITE_PREVIEW_IDENTITY_PROVIDER: 'configured-provider',
  VITE_PREVIEW_IDENTITY_SUBJECT: 'configured-subject',
} as const

function auth0ClientReturningFrom(subject: { provider: string; subject: string }) {
  let authenticated = true

  return {
    loginWithRedirect: vi.fn(async () => undefined),
    handleRedirectCallback: vi.fn(async () => undefined),
    isAuthenticated: vi.fn(async () => authenticated),
    getSubject: vi.fn(async () => (authenticated ? { ...subject, emailVerified: true } : null)),
    logout: vi.fn(async () => {
      authenticated = false
    }),
  }
}

function previewSession(subject: { provider: string; subject: string }) {
  return createAuth0WorkplaceSession(
    auth0ClientReturningFrom(subject),
    createColonyHumanDirectory(CONFIGURED),
  )
}

describe('the configured preview identity reaches the fixture boards', () => {
  it('signs in through a real callback and shows sidebar, Kanban and Example data', async () => {
    const session = previewSession({
      provider: 'configured-provider',
      subject: 'configured-subject',
    })

    await session.completeSignIn()

    render(SessionGate, {
      global: {
        provide: {
          [WORKPLACE_SESSION]: session,
          [TASK_GATEWAY]: createFixtureTaskGateway(),
        },
      },
    })

    expect(screen.queryByTestId('signed-out')).toBeNull()
    expect(screen.getByTestId('sidebar')).toBeTruthy()
    expect(screen.getByTestId('topbar')).toBeTruthy()

    const previewHuman = fixtureHumans.find((human) => human.id === PREVIEW_HUMAN_ID)
    expect(screen.getByTestId('signed-in-human').textContent).toContain(previewHuman?.name ?? '')

    await waitFor(() => {
      expect(screen.getAllByTestId('board-link').length).toBeGreaterThan(0)
    })

    // Opening a board is the journey, not a shortcut around it: the Kanban shows
    // lanes for the board that is open, and nothing is open until one is chosen.
    const [firstBoard] = screen.getAllByTestId('board-link')
    expect(firstBoard).toBeDefined()
    await fireEvent.click(firstBoard as HTMLElement)

    await waitFor(() => {
      expect(screen.getByTestId('kanban-lanes')).toBeTruthy()
    })

    expect(screen.getAllByTestId('kanban-lane').length).toBeGreaterThan(0)
    expect(screen.getByTestId('preview-data-indication').textContent).toBe('Example data')
  })

  it('leaves no usable session after signing out', async () => {
    const session = previewSession({
      provider: 'configured-provider',
      subject: 'configured-subject',
    })

    await session.completeSignIn()

    render(SessionGate, {
      global: {
        provide: {
          [WORKPLACE_SESSION]: session,
          [TASK_GATEWAY]: createFixtureTaskGateway(),
        },
      },
    })

    await fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(screen.getByTestId('signed-out')).toBeTruthy()
    })

    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('preview-data-indication')).toBeNull()
    expect(session.currentHuman.value).toBeNull()

    await session.restore()
    expect(session.currentHuman.value).toBeNull()
  })
})

describe('rejection: a real identity that is not the configured one never reaches a board', () => {
  it('refuses the configured subject arriving under another provider', async () => {
    const session = previewSession({
      provider: 'another-provider',
      subject: 'configured-subject',
    })

    await expect(session.completeSignIn()).rejects.toThrow()
    expect(session.currentHuman.value).toBeNull()
  })

  it('refuses another subject arriving under the configured provider', async () => {
    const session = previewSession({
      provider: 'configured-provider',
      subject: 'another-subject',
    })

    await expect(session.completeSignIn()).rejects.toThrow()
    expect(session.currentHuman.value).toBeNull()
  })

  it('shows the signed-out view, and no board chrome, for a refused identity', async () => {
    const session = previewSession({
      provider: 'configured-provider',
      subject: 'somebody-else',
    })

    await session.restore()

    render(SessionGate, {
      global: {
        provide: {
          [WORKPLACE_SESSION]: session,
          [TASK_GATEWAY]: createFixtureTaskGateway(),
        },
      },
    })

    expect(screen.getByTestId('signed-out')).toBeTruthy()
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('preview-data-indication')).toBeNull()
  })
})
