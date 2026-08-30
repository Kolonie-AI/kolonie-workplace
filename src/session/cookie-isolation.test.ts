import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Auth0ClientAdapter } from '@/session/auth0-client-adapter'
import { createAuth0WorkplaceSession } from '@/session/auth0-workplace-session'

const SESSION_SOURCES = [
  'src/session/auth0-client-adapter.ts',
  'src/session/auth0-workplace-session.ts',
  'src/session/live-config.ts',
  'src/session/sign-in-callback.ts',
  'src/session/workplace-me.ts',
  'src/session/workplace-me.ts',
  'src/mount.ts',
] as const

/**
 * #2: "a console cookie presented to the workplace is rejected."
 *
 * The workplace holds no cookie of its own and reads none. A cookie set for
 * the console host is not sent to the workplace host by the browser at all —
 * that is the browser's origin rule and not something this application can opt
 * out of — and, separately, nothing in this tree would look at it if it were.
 * The second half is what these tests hold: the code has no path by which a
 * cookie could become a session, so there is no way for a console cookie to be
 * honoured here even by mistake.
 */
/**
 * The prose in these files explains *why* no cookie is read, so it necessarily
 * contains the word. The rule is about what the code does, so it reads the
 * source with the comments taken out — the same approach the Kanban, List and
 * detail source tests take.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
}

describe('the workplace session is not a cookie the console could have set', () => {
  it('reads and writes no cookie anywhere in the session slice', () => {
    for (const path of SESSION_SOURCES) {
      const source = withoutComments(readFileSync(resolve(process.cwd(), path), 'utf8'))

      expect(source, `${path} must not touch document.cookie`).not.toMatch(
        /document\s*\.\s*cookie/,
      )
      expect(source, `${path} must not read a token from storage`).not.toMatch(
        /localStorage/,
      )
      expect(source, `${path} must not persist a token`).not.toMatch(
        /sessionStorage/,
      )
    }
  })

  it('never asks whether a human is signed in by inspecting the document', async () => {
    const isAuthenticated = vi.fn(async () => false)
    const adapter = new Auth0ClientAdapter(
      {
        loginWithRedirect: vi.fn(async () => undefined),
        handleRedirectCallback: vi.fn(async () => ({})),
        isAuthenticated,
        getTokenSilently: vi.fn(async () => 'access-token'),
        logout: vi.fn(async () => undefined),
      },
      'https://workplace.example.invalid/sign-in/callback',
      'https://workplace.example.invalid',
      'workplace-audience',
    )

    document.cookie = 'kolonie_console_session=a-console-session-value'

    expect(await adapter.isAuthenticated()).toBe(false)
    expect(isAuthenticated).toHaveBeenCalledTimes(1)
  })

  it('signs nobody in on the strength of a cookie in the document', async () => {
    document.cookie = 'kolonie_console_session=a-console-session-value'

    const session = createAuth0WorkplaceSession(
      {
        loginWithRedirect: vi.fn(async () => undefined),
        handleRedirectCallback: vi.fn(async () => undefined),
        isAuthenticated: vi.fn(async () => false),
        getAccessToken: vi.fn(async () => 'access-token'),
        logout: vi.fn(async () => undefined),
      },
      { me: vi.fn() },
    )

    await session.restore()

    expect(session.currentHuman.value).toBeNull()
    expect(document.cookie).toContain('kolonie_console_session')
  })

  it('logs out to this origin, never to another host', async () => {
    const logout = vi.fn(async () => undefined)
    const adapter = new Auth0ClientAdapter(
      {
        loginWithRedirect: vi.fn(async () => undefined),
        handleRedirectCallback: vi.fn(async () => ({})),
        isAuthenticated: vi.fn(async () => false),
        getTokenSilently: vi.fn(async () => 'access-token'),
        logout,
      },
      'https://workplace.example.invalid/sign-in/callback',
      'https://workplace.example.invalid',
      'workplace-audience',
    )

    await adapter.logout()

    const [call] = logout.mock.calls as unknown as [
      [{ logoutParams: { returnTo: string } }],
    ]
    expect(call[0].logoutParams.returnTo).toBe('https://workplace.example.invalid')
  })

  /**
   * The console's session travels as `__Host-kolonie_session`
   * (`apps/api/src/routes/authenticated.ts`). The `__Host-` prefix is the
   * browser's own guarantee that the cookie carries no `Domain` attribute and
   * is therefore returned to exactly one host — so the console's cookie is
   * never sent to the workplace origin in the first place.
   *
   * That is the browser's half. This test holds the workplace's half: even
   * presented with that exact cookie name, nothing here turns it into a
   * session, because the only thing that establishes one is the SDK's own
   * same-origin state.
   */
  it('ignores the console session cookie by name, presented directly', async () => {
    document.cookie = '__Host-kolonie_session=a-real-looking-console-session'

    const session = createAuth0WorkplaceSession(
      {
        loginWithRedirect: vi.fn(async () => undefined),
        handleRedirectCallback: vi.fn(async () => undefined),
        isAuthenticated: vi.fn(async () => false),
        getAccessToken: vi.fn(async () => 'access-token'),
        logout: vi.fn(async () => undefined),
      },
      { me: vi.fn() },
    )

    await session.restore()

    expect(session.currentHuman.value).toBeNull()
  })

  it('derives the redirect and the return from the configured callback alone', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/session/provide-session.ts'),
      'utf8',
    )

    expect(source).toContain('new URL(config.callback).origin')
  })
})
