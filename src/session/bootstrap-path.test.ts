import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/vue'
import { mountWorkplace } from '@/mount'
import { Auth0ClientAdapter } from '@/session/auth0-client-adapter'
import { createAuth0WorkplaceSession } from '@/session/auth0-workplace-session'
import type { CitizenStorage } from '@/session/citizen-storage'

const LIVE_ENV = {
  VITE_AUTH0_DOMAIN: 'configured-domain',
  VITE_AUTH0_CLIENT_ID: 'configured-client-id',
  VITE_AUTH0_CALLBACK: 'https://workplace.example.invalid/sign-in/callback',
  VITE_AUTH0_AUDIENCE: 'configured-audience',
  VITE_PLATFORM_API_ORIGIN: 'https://platform.example.invalid',
} as const

const memoryStorage: CitizenStorage = {
  read: () => null,
  write: () => undefined,
  clear: () => undefined,
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  document.body.innerHTML = ''
})

describe('the real bootstrap path issues the board request for the picked citizen', () => {
  /**
   * #116. Production loads the bundle in a browser whose `fetch` refuses any
   * receiver that is not its own global, so the gateway's stored reference must
   * never be invoked as a method of the gateway. This double enforces exactly
   * that contract through the real bootstrap composition, with nothing injected
   * — which is how the deployed application is configured.
   */
  function receiverSensitiveGlobalFetch(
    handler: (url: string) => Response,
  ) {
    const calls: { url: string; init: RequestInit; receiver: unknown }[] = []
    const native = vi.fn(async function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      if (this !== globalThis) {
        throw new TypeError("'fetch' called on an object that does not implement interface Window.")
      }
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push({ url, init: init ?? {}, receiver: this })
      return handler(url)
    })
    return { native, calls }
  }

  it('reaches the Colony through a fetch that demands its global receiver', async () => {
    for (const [name, value] of Object.entries(LIVE_ENV)) {
      vi.stubEnv(name, value)
    }

    const adapter = new Auth0ClientAdapter(
      {
        loginWithRedirect: vi.fn(async () => undefined),
        handleRedirectCallback: vi.fn(async () => ({ appState: undefined })),
        isAuthenticated: vi.fn(async () => true),
        getTokenSilently: vi.fn(async () => 'access-token'),
        logout: vi.fn(async () => undefined),
      },
      LIVE_ENV.VITE_AUTH0_CALLBACK,
      'https://workplace.example.invalid',
      LIVE_ENV.VITE_AUTH0_AUDIENCE,
    )
    const session = createAuth0WorkplaceSession(adapter, {
      me: vi.fn(async () => ({
        human: { id: 'human-operator' },
        agents: [{ id: 'agent-quill', handle: 'quill', status: 'citizen' }],
      })),
    }, memoryStorage)
    await session.restore()

    const { native, calls } = receiverSensitiveGlobalFetch((url) => {
      if (url.endsWith('/v1/workplace/boards')) {
        return new Response(JSON.stringify({
          items: [{
            id: 'board-default',
            ownerId: 'agent-quill',
            title: 'Citizen default board',
            kind: 'default',
            version: 1,
          }],
          nextCursor: null,
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 })
    })
    vi.stubGlobal('fetch', native)

    document.body.innerHTML = '<div id="app"></div>'
    const app = mountWorkplace('#app', session)
    try {
      await screen.findByTestId('citizen-gate')
      await fireEvent.click(screen.getByRole('button', { name: /continue as quill/i }))

      await waitFor(() => {
        expect(screen.getByTestId('active-board').textContent).toContain('Citizen default board')
      })
      const boards = calls.find((call) => call.url.endsWith('/v1/workplace/boards'))
      expect(boards).toBeDefined()
      expect(boards?.receiver).toBe(globalThis)
      expect(new Headers(boards?.init.headers).get('X-Kolonie-Citizen')).toBe('agent-quill')
      expect(screen.queryByTestId('boards-error')).toBeNull()
    } finally {
      app.unmount()
    }
  })

  it('mounts through mountWorkplace and fetches boards after the citizen pick', async () => {
    for (const [name, value] of Object.entries(LIVE_ENV)) {
      vi.stubEnv(name, value)
    }

    const getTokenSilently = vi.fn(async () => 'access-token')
    const adapter = new Auth0ClientAdapter(
      {
        loginWithRedirect: vi.fn(async () => undefined),
        handleRedirectCallback: vi.fn(async () => ({ appState: undefined })),
        isAuthenticated: vi.fn(async () => true),
        getTokenSilently,
        logout: vi.fn(async () => undefined),
      },
      LIVE_ENV.VITE_AUTH0_CALLBACK,
      'https://workplace.example.invalid',
      LIVE_ENV.VITE_AUTH0_AUDIENCE,
    )
    const session = createAuth0WorkplaceSession(adapter, {
      me: vi.fn(async () => ({
        human: { id: 'human-operator' },
        agents: [{ id: 'agent-quill', handle: 'quill', status: 'citizen' }],
      })),
    }, memoryStorage)
    await session.restore()

    const requests: { url: string; init: RequestInit }[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      requests.push({ url, init: init ?? {} })
      if (url.endsWith('/v1/workplace/boards')) {
        return new Response(JSON.stringify({
          items: [{
            id: 'board-default',
            ownerId: 'agent-quill',
            title: 'Citizen default board',
            kind: 'default',
            version: 1,
          }],
          nextCursor: null,
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 })
    }))

    document.body.innerHTML = '<div id="app"></div>'
    const app = mountWorkplace('#app', session)
    try {
      await screen.findByTestId('citizen-gate')
      await fireEvent.click(screen.getByRole('button', { name: /continue as quill/i }))

      await waitFor(() => {
        expect(screen.getByTestId('active-board').textContent).toContain('Citizen default board')
      })
      const boards = requests.find((request) => request.url.endsWith('/v1/workplace/boards'))
      expect(boards).toBeDefined()
      const headers = new Headers(boards?.init.headers)
      expect(headers.get('X-Kolonie-Citizen')).toBe('agent-quill')
    } finally {
      app.unmount()
    }
  })
})
