import { describe, expect, it, vi } from 'vitest'
import { Auth0ClientAdapter } from '@/session/auth0-client-adapter'
import type { Auth0SdkClient } from '@/session/auth0-client-adapter'

function sdk(overrides: Partial<Auth0SdkClient> = {}): Auth0SdkClient {
  return {
    loginWithRedirect: vi.fn(async () => undefined),
    handleRedirectCallback: vi.fn(async () => ({ appState: undefined })),
    isAuthenticated: vi.fn(async () => false),
    getTokenSilently: vi.fn(async () => 'access-token'),
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
      'workplace-audience',
    )

    await adapter.loginWithRedirect()

    expect(client.loginWithRedirect).toHaveBeenCalledWith({
      authorizationParams: {
        redirect_uri: 'https://workplace.example.invalid/sign-in/callback',
        audience: 'workplace-audience',
      },
    })
  })

  it('completes the callback through the SDK and never parses tokens itself', async () => {
    const client = sdk()
    const adapter = new Auth0ClientAdapter(
      client,
      'https://workplace.example.invalid/sign-in/callback',
      'https://workplace.example.invalid',
      'workplace-audience',
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
      'workplace-audience',
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
      'workplace-audience',
    )

    expect(await adapter.isAuthenticated()).toBe(true)
    expect(client.isAuthenticated).toHaveBeenCalledTimes(1)
  })
})

describe('Auth0 client adapter — access token', () => {
  it('requests an audience-bound access token through the SDK', async () => {
    const getTokenSilently = vi.fn(async () => 'access-token')
    const adapter = new Auth0ClientAdapter(
      sdk({ getTokenSilently }),
      'https://workplace.example.invalid/sign-in/callback',
      'https://workplace.example.invalid',
      'workplace-audience',
    )

    await expect(adapter.getAccessToken()).resolves.toBe('access-token')
    expect(getTokenSilently).toHaveBeenCalledWith({
      authorizationParams: { audience: 'workplace-audience' },
    })
  })
})
