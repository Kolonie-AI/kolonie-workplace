import { describe, expect, it, vi } from 'vitest'
import { isSignInCallback, startSession, SIGN_IN_CALLBACK_PATH } from '@/session/sign-in-callback'
import type { Auth0WorkplaceSession } from '@/session/auth0-workplace-session'
import type { WorkplaceSession } from '@/session/workplace-session'

function auth0Session(overrides: Partial<Auth0WorkplaceSession> = {}): Auth0WorkplaceSession {
  return {
    currentHuman: { value: null } as WorkplaceSession['currentHuman'],
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    completeSignIn: vi.fn(async () => undefined),
    restore: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('the callback path is recognised, and only that path', () => {
  it('recognises the registered callback path', () => {
    expect(isSignInCallback(`https://workplace.example.invalid${SIGN_IN_CALLBACK_PATH}?code=x&state=y`))
      .toBe(true)
  })

  it('does not treat the board itself as a callback', () => {
    expect(isSignInCallback('https://workplace.example.invalid/')).toBe(false)
    expect(isSignInCallback('https://workplace.example.invalid/boards')).toBe(false)
  })

  it('requires the authorization parameters, not merely the path', () => {
    expect(isSignInCallback(`https://workplace.example.invalid${SIGN_IN_CALLBACK_PATH}`)).toBe(false)
  })

  it('recognises an error the tenant redirects back with', () => {
    expect(
      isSignInCallback(
        `https://workplace.example.invalid${SIGN_IN_CALLBACK_PATH}?error=access_denied`,
      ),
    ).toBe(true)
  })
})

describe('starting the session on load', () => {
  it('completes the redirect when the page is the callback', async () => {
    const session = auth0Session()

    await startSession(session, `https://workplace.example.invalid${SIGN_IN_CALLBACK_PATH}?code=x&state=y`)

    expect(session.completeSignIn).toHaveBeenCalledTimes(1)
    expect(session.restore).not.toHaveBeenCalled()
  })

  it('restores an existing session on an ordinary page load', async () => {
    const session = auth0Session()

    await startSession(session, 'https://workplace.example.invalid/')

    expect(session.restore).toHaveBeenCalledTimes(1)
    expect(session.completeSignIn).not.toHaveBeenCalled()
  })

  it('does nothing at all for a session that is not the Auth0 one', async () => {
    const fixture: WorkplaceSession = {
      currentHuman: { value: null } as WorkplaceSession['currentHuman'],
      signIn: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
    }

    await expect(
      startSession(fixture, `https://workplace.example.invalid${SIGN_IN_CALLBACK_PATH}?code=x`),
    ).resolves.toBeUndefined()
    expect(fixture.signIn).not.toHaveBeenCalled()
  })

  it('swallows a refused callback rather than leaving the app unmounted', async () => {
    const session = auth0Session({
      completeSignIn: vi.fn(async () => {
        throw new Error('Kolonie Workplace: that sign-in did not resolve.')
      }),
    })

    await expect(
      startSession(session, `https://workplace.example.invalid${SIGN_IN_CALLBACK_PATH}?code=x&state=y`),
    ).resolves.toBeUndefined()
  })

  it('signs nobody in when the callback is refused', async () => {
    const session = auth0Session({
      completeSignIn: vi.fn(async () => {
        throw new Error('Kolonie Workplace: that sign-in did not resolve.')
      }),
    })

    await startSession(session, `https://workplace.example.invalid${SIGN_IN_CALLBACK_PATH}?code=x&state=y`)

    expect(session.currentHuman.value).toBeNull()
  })
})
