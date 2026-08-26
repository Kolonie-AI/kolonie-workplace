import type { Auth0WorkplaceSession } from '@/session/auth0-workplace-session'
import type { WorkplaceSession } from '@/session/workplace-session'

export const SIGN_IN_CALLBACK_PATH = '/sign-in/callback'

export function isSignInCallback(url: string): boolean {
  const parsed = new URL(url)

  return parsed.pathname === SIGN_IN_CALLBACK_PATH &&
    (parsed.searchParams.has('code') || parsed.searchParams.has('error'))
}

function asAuth0Session(session: WorkplaceSession): Auth0WorkplaceSession | null {
  const candidate = session as WorkplaceSession & Partial<Auth0WorkplaceSession>

  return typeof candidate.completeSignIn === 'function' &&
    typeof candidate.restore === 'function'
    ? (candidate as Auth0WorkplaceSession)
    : null
}

/**
 * Session bootstrap happens before the application is mounted, so the page
 * never flashes the signed-out screen between the callback and the resolved
 * human. A refusal is deliberately swallowed here: `Auth0Session` clears the
 * human before it throws, and the mounted application then shows its ordinary
 * signed-out screen, never a half-established session.
 *
 * The path check is local; the SDK validates the callback's `state`, exchanges
 * the authorization code with PKCE and determines whether the session is
 * authenticated. Nothing in this repository parses or verifies tokens.
 */
export async function startSession(
  session: WorkplaceSession,
  url: string,
): Promise<void> {
  const auth0 = asAuth0Session(session)

  if (auth0 === null) {
    return
  }

  try {
    if (isSignInCallback(url)) {
      await auth0.completeSignIn()
      return
    }

    await auth0.restore()
  } catch {
    // `Auth0Session` has already cleared the human; mount signed out.
  }
}
