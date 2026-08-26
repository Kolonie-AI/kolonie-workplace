import { describe, expect, it, vi } from 'vitest'
import type { User } from '@auth0/auth0-spa-js'
import { Auth0ClientAdapter, parseFederatedSubject } from '@/session/auth0-client-adapter'
import type { Auth0SdkClient } from '@/session/auth0-client-adapter'

function sdk(overrides: Partial<Auth0SdkClient> = {}): Auth0SdkClient {
  return {
    loginWithRedirect: vi.fn(async () => undefined),
    handleRedirectCallback: vi.fn(async () => ({ appState: undefined })),
    isAuthenticated: vi.fn(async () => false),
    getUser: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('Auth0 client adapter — PKCE redirect and workplace-origin session', () => {
  it('sends sign-in through the SDK with the configured workplace callback', async () => {
    const client = sdk()
    const adapter = new Auth0ClientAdapter(
      client,
      'https://workplace.example.invalid/sign-in/callback',
      'https://workplace.example.invalid',
    )

    await adapter.loginWithRedirect()

    expect(client.loginWithRedirect).toHaveBeenCalledWith({
      authorizationParams: {
        redirect_uri: 'https://workplace.example.invalid/sign-in/callback',
      },
    })
  })

  it('completes the callback through the SDK and never parses tokens itself', async () => {
    const client = sdk()
    const adapter = new Auth0ClientAdapter(
      client,
      'https://workplace.example.invalid/sign-in/callback',
      'https://workplace.example.invalid',
    )

    await adapter.handleRedirectCallback()

    expect(client.handleRedirectCallback).toHaveBeenCalledTimes(1)
  })

  it('logs out from this workplace and returns to its own origin', async () => {
    const client = sdk()
    const adapter = new Auth0ClientAdapter(
      client,
      'https://workplace.example.invalid/sign-in/callback',
      'https://workplace.example.invalid',
    )

    await adapter.logout()

    expect(client.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: 'https://workplace.example.invalid' },
    })
  })

  it('reports the SDK authentication state and nothing from document.cookie', async () => {
    const client = sdk({ isAuthenticated: vi.fn(async () => true) })
    const adapter = new Auth0ClientAdapter(
      client,
      'https://workplace.example.invalid/sign-in/callback',
      'https://workplace.example.invalid',
    )

    expect(await adapter.isAuthenticated()).toBe(true)
    expect(client.isAuthenticated).toHaveBeenCalledTimes(1)
  })
})

describe('Auth0 client adapter — federated subject', () => {
  /**
   * These expectations are taken from the platform's own reading of the same
   * claim, in `apps/api/src/humans/auth0.ts`. The `sub` prefix is a *strategy*
   * and the Colony stores its own name for the door, so the two must agree
   * exactly or a person who signs in here resolves to nobody while the same
   * person signing in at the console resolves fine.
   */
  it('maps the strategy to the Colony provider name and keeps the bare subject', () => {
    expect(
      parseFederatedSubject({
        sub: 'google-oauth2|wren',
        email_verified: true,
      } as User),
    ).toEqual({
      provider: 'google',
      subject: 'wren',
      emailVerified: true,
    })
  })

  it('maps the database strategy to password, as the console does', () => {
    expect(
      parseFederatedSubject({ sub: 'auth0|68f2abc', email_verified: true } as User),
    ).toEqual({
      provider: 'password',
      subject: '68f2abc',
      emailVerified: true,
    })
  })

  it('maps twitter to x and leaves github alone', () => {
    expect(parseFederatedSubject({ sub: 'twitter|42' } as User)?.provider).toBe('x')
    expect(parseFederatedSubject({ sub: 'github|ash' } as User)?.provider).toBe('github')
  })

  it('keeps a subject that itself contains a separator whole', () => {
    expect(
      parseFederatedSubject({ sub: 'oidc|corp|nested-id', email_verified: true } as User),
    ).toEqual({
      provider: 'oidc',
      subject: 'corp|nested-id',
      emailVerified: true,
    })
  })

  it('returns no subject when Auth0 has no sub claim', () => {
    expect(parseFederatedSubject({ email_verified: true } as User)).toBeNull()
  })

  it('refuses a malformed sub with no provider separator', () => {
    expect(
      parseFederatedSubject({ sub: 'malformed-subject', email_verified: true } as User),
    ).toBeNull()
  })

  it('treats a missing verification claim as unverified', () => {
    expect(parseFederatedSubject({ sub: 'github|ash' } as User)).toEqual({
      provider: 'github',
      subject: 'ash',
      emailVerified: false,
    })
  })

  it('reads the subject through the SDK profile call', async () => {
    const client = sdk({
      getUser: vi.fn(async () => ({
        sub: 'github|ash',
        email_verified: true,
      })),
    })
    const adapter = new Auth0ClientAdapter(
      client,
      'https://workplace.example.invalid/sign-in/callback',
      'https://workplace.example.invalid',
    )

    expect(await adapter.getSubject()).toEqual({
      provider: 'github',
      subject: 'ash',
      emailVerified: true,
    })
  })
})
