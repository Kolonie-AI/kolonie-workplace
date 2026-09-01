import { describe, expect, it, vi } from 'vitest'
import { createAuth0WorkplaceSession } from '@/session/auth0-workplace-session'
import type { Auth0Client } from '@/session/auth0-workplace-session'
import type { CitizenStorage } from '@/session/citizen-storage'
import type { WorkplaceMe, WorkplaceMeClient } from '@/session/workplace-me'
import { WorkplaceForbidden, WorkplaceUnauthorized } from '@/gateway/workplace-http-errors'
import { IdentityNotRecognised } from '@/session/refusals'

const ME: WorkplaceMe = {
  human: { id: 'human-operator' },
  agents: [
    { id: 'agent-quill', handle: 'quill', status: 'citizen' },
    { id: 'agent-marlow', handle: 'marlow', status: 'citizen' },
  ],
}

function client(overrides: Partial<Auth0Client> = {}): Auth0Client {
  return {
    loginWithRedirect: vi.fn(async () => undefined),
    handleRedirectCallback: vi.fn(async () => undefined),
    isAuthenticated: vi.fn(async () => false),
    getAccessToken: vi.fn(async () => 'access-token'),
    logout: vi.fn(async () => undefined),
    ...overrides,
  }
}

function meClient(result: WorkplaceMe | Error = ME): WorkplaceMeClient {
  return {
    me: vi.fn(async () => {
      if (result instanceof Error) {
        throw result
      }
      return result
    }),
  }
}

function storage(initial: string | null = null): CitizenStorage & { value: string | null } {
  const state = {
    value: initial,
    read: vi.fn(() => state.value),
    write: vi.fn((id: string) => {
      state.value = id
    }),
    clear: vi.fn(() => {
      state.value = null
    }),
  }
  return state
}

describe('Auth0 session — live Colony identity', () => {
  it('holds nobody and no linked citizens before authentication', () => {
    const session = createAuth0WorkplaceSession(client(), meClient(), storage())

    expect(session.currentHuman.value).toBeNull()
    expect(session.linkedAgents?.value).toBeNull()
  })

  it('sends the human to hosted login without asking the SPA for an identity', async () => {
    const auth0 = client()
    const session = createAuth0WorkplaceSession(auth0, meClient(), storage())

    await session.signIn()

    expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1)
    expect(session.currentHuman.value).toBeNull()
  })

  it('reads /me with the audience-bound token after the callback', async () => {
    const auth0 = client({ isAuthenticated: vi.fn(async () => true) })
    const me = meClient()
    const session = createAuth0WorkplaceSession(auth0, me, storage())

    await session.completeSignIn()

    expect(me.me).toHaveBeenCalledWith('access-token')
    expect(session.linkedAgents?.value).toEqual(ME.agents)
    expect(session.currentHuman.value).toBeNull()
  })

  it('requires an explicit citizen pick even when /me returns one citizen', async () => {
    const one = meClient({ human: ME.human, agents: [ME.agents[0]!] })
    const session = createAuth0WorkplaceSession(
      client({ isAuthenticated: vi.fn(async () => true) }),
      one,
      storage(),
    )

    await session.restore()

    expect(session.currentHuman.value).toBeNull()
    session.pickCitizen?.('agent-quill')
    expect(session.currentHuman.value).toEqual({
      id: 'agent-quill',
      name: 'quill',
      agentIds: ['agent-quill'],
    })
  })

  it('restores only a selected citizen that is still linked', async () => {
    const saved = storage('agent-marlow')
    const session = createAuth0WorkplaceSession(
      client({ isAuthenticated: vi.fn(async () => true) }),
      meClient(),
      saved,
    )

    await session.restore()

    expect(session.currentHuman.value).toEqual({
      id: 'agent-marlow',
      name: 'marlow',
      agentIds: ['agent-marlow'],
    })
    expect(saved.read).toHaveBeenCalledTimes(1)
  })

  it('ignores an unlinked citizen id and never persists it', async () => {
    const saved = storage()
    const session = createAuth0WorkplaceSession(
      client({ isAuthenticated: vi.fn(async () => true) }),
      meClient(),
      saved,
    )
    await session.restore()

    session.pickCitizen?.('agent-stranger')

    expect(session.currentHuman.value).toBeNull()
    expect(saved.write).not.toHaveBeenCalled()
  })

  it('keeps an empty agents response as an honest empty state', async () => {
    const session = createAuth0WorkplaceSession(
      client({ isAuthenticated: vi.fn(async () => true) }),
      meClient({ human: ME.human, agents: [] }),
      storage(),
    )

    await session.restore()

    expect(session.linkedAgents?.value).toEqual([])
    expect(session.currentHuman.value).toBeNull()
  })

  it('clears the selected citizen and session storage on sign-out', async () => {
    const saved = storage('agent-quill')
    const auth0 = client({ isAuthenticated: vi.fn(async () => true) })
    const session = createAuth0WorkplaceSession(auth0, meClient(), saved)
    await session.restore()

    await session.signOut()

    expect(session.currentHuman.value).toBeNull()
    expect(session.linkedAgents?.value).toBeNull()
    expect(saved.clear).toHaveBeenCalled()
    expect(auth0.logout).toHaveBeenCalledTimes(1)
  })

  it('switches citizen without logging out of Auth0', async () => {
    const saved = storage('agent-quill')
    const auth0 = client({ isAuthenticated: vi.fn(async () => true) })
    const session = createAuth0WorkplaceSession(auth0, meClient(), saved)
    await session.restore()

    session.switchCitizen?.()

    expect(session.currentHuman.value).toBeNull()
    expect(session.linkedAgents?.value).toEqual(ME.agents)
    expect(saved.clear).toHaveBeenCalled()
    expect(auth0.logout).not.toHaveBeenCalled()

    session.pickCitizen?.('agent-marlow')
    expect(session.currentHuman.value?.id).toBe('agent-marlow')
    expect(saved.value).toBe('agent-marlow')
  })

  it('returns the access token through the session port', async () => {
    const auth0 = client({ getAccessToken: vi.fn(async () => 'fresh-token') })
    const session = createAuth0WorkplaceSession(auth0, meClient(), storage())

    await expect(session.getAccessToken?.()).resolves.toBe('fresh-token')
  })

  it('clears a selected citizen when silent token acquisition loses the audience grant', async () => {
    const saved = storage('agent-quill')
    const auth0 = client({ isAuthenticated: vi.fn(async () => true) })
    const me = meClient()
    const session = createAuth0WorkplaceSession(auth0, me, saved)
    await session.restore()
    expect(session.currentHuman.value?.id).toBe('agent-quill')

    const tokenFailure = new WorkplaceUnauthorized()
    auth0.getAccessToken = vi.fn(async () => { throw tokenFailure })

    await expect(session.getAccessToken?.()).rejects.toBe(tokenFailure)
    expect(session.currentHuman.value).toBeNull()
    expect(session.linkedAgents?.value).toBeNull()
    expect(saved.clear).toHaveBeenCalled()
    expect(session.failure?.value).toBe('unauthorized')
  })

  it('sets reactive unauthorized state before best-effort storage cleanup', async () => {
    const auth0 = client({ isAuthenticated: vi.fn(async () => true) })
    const saved = storage('agent-quill')
    const session = createAuth0WorkplaceSession(auth0, meClient(), saved)
    await session.restore()
    const statesDuringClear: unknown[] = []
    saved.clear = vi.fn(() => {
      statesDuringClear.push({
        human: session.currentHuman.value,
        agents: session.linkedAgents?.value,
        failure: session.failure?.value,
      })
      throw new Error('storage unavailable')
    })

    const refusal = new WorkplaceUnauthorized()
    auth0.getAccessToken = vi.fn(async () => { throw refusal })

    await expect(session.getAccessToken?.()).rejects.toBe(refusal)
    expect(statesDuringClear).toEqual([{ human: null, agents: null, failure: 'unauthorized' }])
    expect(session.currentHuman.value).toBeNull()
    expect(session.linkedAgents?.value).toBeNull()
    expect(session.failure?.value).toBe('unauthorized')
  })
})

describe('Auth0 session — rejection and quiet restore', () => {
  it('refuses a callback when Auth0 has no authenticated session', async () => {
    const session = createAuth0WorkplaceSession(client(), meClient(), storage())

    await expect(session.completeSignIn()).rejects.toBeInstanceOf(IdentityNotRecognised)
  })

  it('maps a /me 401 to a sign-in refusal after callback', async () => {
    const session = createAuth0WorkplaceSession(
      client({ isAuthenticated: vi.fn(async () => true) }),
      meClient(new WorkplaceUnauthorized()),
      storage(),
    )

    await expect(session.completeSignIn()).rejects.toBeInstanceOf(IdentityNotRecognised)
    expect(session.currentHuman.value).toBeNull()
  })

  it('preserves non-auth deployment failures after callback', async () => {
    const failure = new Error('origin refused')
    const session = createAuth0WorkplaceSession(
      client({ isAuthenticated: vi.fn(async () => true) }),
      meClient(failure),
      storage(),
    )

    await expect(session.completeSignIn()).rejects.toBe(failure)
  })

  it('preserves a forbidden origin as a deployment state during quiet restore', async () => {
    const session = createAuth0WorkplaceSession(
      client({ isAuthenticated: vi.fn(async () => true) }),
      meClient(new WorkplaceForbidden()),
      storage(),
    )

    await session.restore()

    expect(session.failure?.value).toBe('forbidden')
    expect(session.currentHuman.value).toBeNull()
  })

  it('preserves an expired token as a sign-in-again state during quiet restore', async () => {
    const session = createAuth0WorkplaceSession(
      client({ isAuthenticated: vi.fn(async () => true) }),
      meClient(new WorkplaceUnauthorized()),
      storage(),
    )

    await session.restore()

    expect(session.failure?.value).toBe('unauthorized')
    expect(session.currentHuman.value).toBeNull()
  })

  it('quietly clears state when restoring an expired session', async () => {
    const saved = storage('agent-quill')
    const session = createAuth0WorkplaceSession(client(), meClient(), saved)

    await session.restore()

    expect(session.currentHuman.value).toBeNull()
    expect(session.linkedAgents?.value).toBeNull()
  })
})
