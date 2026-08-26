import { describe, expect, it, vi } from 'vitest'
import type { Human } from '@/domain/workplace'
import { createAuth0WorkplaceSession } from '@/session/auth0-workplace-session'
import type { Auth0Client, Auth0Subject } from '@/session/auth0-workplace-session'
import type { HumanDirectory } from '@/session/human-directory'
import { IdentityNotRecognised, IdentityUnverified } from '@/session/refusals'

const WREN: Human = {
  id: 'human-wren',
  name: 'Fictional Human Wren',
  agentIds: ['agent-quill'],
}
const ASH: Human = {
  id: 'human-ash',
  name: 'Fictional Human Ash',
  agentIds: ['agent-marlow'],
}

const WREN_SUBJECT: Auth0Subject = {
  provider: 'google',
  subject: 'wren',
  emailVerified: true,
}
const ASH_SUBJECT: Auth0Subject = {
  provider: 'github',
  subject: 'ash',
  emailVerified: true,
}

function directory(
  entries: readonly (readonly [string, string, Human])[] = [
    ['google', 'wren', WREN],
    ['github', 'ash', ASH],
  ],
): HumanDirectory {
  return {
    resolve: vi.fn(async (provider: string, subject: string) => {
      const found = entries.find(
        ([entryProvider, entrySubject]) =>
          entryProvider === provider && entrySubject === subject,
      )

      return found?.[2] ?? null
    }),
  }
}

function client(overrides: Partial<Auth0Client> = {}): Auth0Client {
  return {
    loginWithRedirect: vi.fn(async () => undefined),
    handleRedirectCallback: vi.fn(async () => undefined),
    isAuthenticated: vi.fn(async () => false),
    getSubject: vi.fn(async () => null),
    logout: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('Auth0 session — the federated login, not a new credential', () => {
  it('holds nobody until a redirect has been completed', async () => {
    const session = createAuth0WorkplaceSession(client(), directory())

    expect(session.currentHuman.value).toBeNull()
  })

  it('sends the human to the hosted login rather than asking for a password', async () => {
    const auth0 = client()
    const session = createAuth0WorkplaceSession(auth0, directory())

    await session.signIn()

    expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1)
    expect(session.currentHuman.value).toBeNull()
  })

  it('resolves the returning subject to the existing Colony human', async () => {
    const auth0 = client({
      isAuthenticated: vi.fn(async () => true),
      getSubject: vi.fn(async () => WREN_SUBJECT),
    })
    const humans = directory()
    const session = createAuth0WorkplaceSession(auth0, humans)

    await session.completeSignIn()

    expect(humans.resolve).toHaveBeenCalledWith('google', 'wren')
    expect(session.currentHuman.value).toEqual(WREN)
  })

  it('restores an existing session without a second trip to the login', async () => {
    const auth0 = client({
      isAuthenticated: vi.fn(async () => true),
      getSubject: vi.fn(async () => WREN_SUBJECT),
    })
    const session = createAuth0WorkplaceSession(auth0, directory())

    await session.restore()

    expect(session.currentHuman.value).toEqual(WREN)
    expect(auth0.loginWithRedirect).not.toHaveBeenCalled()
  })

  it('ends the session on sign-out and leaves nobody signed in', async () => {
    const auth0 = client({
      isAuthenticated: vi.fn(async () => true),
      getSubject: vi.fn(async () => WREN_SUBJECT),
    })
    const session = createAuth0WorkplaceSession(auth0, directory())

    await session.restore()
    expect(session.currentHuman.value).toEqual(WREN)

    await session.signOut()

    expect(auth0.logout).toHaveBeenCalledTimes(1)
    expect(session.currentHuman.value).toBeNull()
  })
})

describe('Auth0 session — rejection: an identity the Colony does not recognise', () => {
  it('refuses a subject with no humans row and signs nobody in', async () => {
    const auth0 = client({
      isAuthenticated: vi.fn(async () => true),
      getSubject: vi.fn(async () => ({
        provider: 'google',
        subject: 'stranger',
        emailVerified: true,
      })),
    })
    const session = createAuth0WorkplaceSession(auth0, directory())

    await expect(session.completeSignIn()).rejects.toBeInstanceOf(IdentityNotRecognised)
    expect(session.currentHuman.value).toBeNull()
  })

  it('refuses an unverified identity even where a humans row exists', async () => {
    const auth0 = client({
      isAuthenticated: vi.fn(async () => true),
      getSubject: vi.fn(async () => ({ ...WREN_SUBJECT, emailVerified: false })),
    })
    const humans = directory()
    const session = createAuth0WorkplaceSession(auth0, humans)

    await expect(session.completeSignIn()).rejects.toBeInstanceOf(IdentityUnverified)
    expect(session.currentHuman.value).toBeNull()
    expect(humans.resolve).not.toHaveBeenCalled()
  })

  it('names no identity in the refusal it hands back', async () => {
    const auth0 = client({
      isAuthenticated: vi.fn(async () => true),
      getSubject: vi.fn(async () => ({
        provider: 'google',
        subject: 'stranger',
        emailVerified: true,
      })),
    })
    const session = createAuth0WorkplaceSession(auth0, directory())

    const refusal = await session.completeSignIn().then(() => null).catch((e: unknown) => e)

    expect((refusal as Error).message).not.toContain('stranger')
  })

  it('signs nobody in when Auth0 reports no authenticated subject at all', async () => {
    const session = createAuth0WorkplaceSession(
      client({ isAuthenticated: vi.fn(async () => false) }),
      directory(),
    )

    await expect(session.completeSignIn()).rejects.toBeInstanceOf(IdentityNotRecognised)
    expect(session.currentHuman.value).toBeNull()
  })
})

describe('Auth0 session — rejection: one human never resolves to another', () => {
  it('keys strictly on the provider and the subject together', async () => {
    const humans = directory()
    const crossed = createAuth0WorkplaceSession(
      client({
        isAuthenticated: vi.fn(async () => true),
        getSubject: vi.fn(async () => ({
          provider: 'github',
          subject: 'wren',
          emailVerified: true,
        })),
      }),
      humans,
    )

    await expect(crossed.completeSignIn()).rejects.toBeInstanceOf(IdentityNotRecognised)
    expect(crossed.currentHuman.value).toBeNull()
  })

  it('gives each subject its own human and never the previously signed-in one', async () => {
    const humans = directory()
    const wrenSession = createAuth0WorkplaceSession(
      client({
        isAuthenticated: vi.fn(async () => true),
        getSubject: vi.fn(async () => WREN_SUBJECT),
      }),
      humans,
    )
    const ashSession = createAuth0WorkplaceSession(
      client({
        isAuthenticated: vi.fn(async () => true),
        getSubject: vi.fn(async () => ASH_SUBJECT),
      }),
      humans,
    )

    await wrenSession.restore()
    await ashSession.restore()

    expect(wrenSession.currentHuman.value).toEqual(WREN)
    expect(ashSession.currentHuman.value).toEqual(ASH)
    expect(ashSession.currentHuman.value).not.toEqual(wrenSession.currentHuman.value)
  })

  it('drops the held human when a later read resolves to nobody', async () => {
    let subject: Auth0Subject | null = WREN_SUBJECT
    const session = createAuth0WorkplaceSession(
      client({
        isAuthenticated: vi.fn(async () => true),
        getSubject: vi.fn(async () => subject),
      }),
      directory(),
    )

    await session.restore()
    expect(session.currentHuman.value).toEqual(WREN)

    subject = null
    await session.restore()

    expect(session.currentHuman.value).toBeNull()
  })
})

describe('Auth0 session — it is an implementation of the port and nothing more', () => {
  it('offers no development picker, so no signed-out fixture list can appear', async () => {
    const session = createAuth0WorkplaceSession(client(), directory())

    expect((session as { isDevelopmentAffordance?: unknown }).isDevelopmentAffordance)
      .toBeUndefined()
    expect((session as { listSignInCandidates?: unknown }).listSignInCandidates)
      .toBeUndefined()
  })
})
