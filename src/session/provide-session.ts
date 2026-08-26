import { provide } from 'vue'
import { Auth0Client as Auth0SpaClient } from '@auth0/auth0-spa-js'
import { readAuth0Config } from '@/session/auth0-config'
import { Auth0ClientAdapter } from '@/session/auth0-client-adapter'
import { createAuth0WorkplaceSession } from '@/session/auth0-workplace-session'
import { createColonyHumanDirectory } from '@/session/colony-human-directory'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

/**
 * The single composition point where an implementation of the session port is
 * chosen. No shell or board component moved to introduce the real login: they
 * resolve the port and never an implementation of it.
 */
export interface SessionChoice {
  readonly env: Readonly<Record<string, string | undefined>>
}

/**
 * The application signs people in with Auth0 or it does not start.
 *
 * **There is deliberately no build-mode branch and no fallback.** The fixture
 * picker signs anybody in as anybody with no credential at all, so composing it
 * here would not be a degraded experience — it would be an open door, and one
 * that a mis-set build flag or a stripped environment would open silently. When
 * configuration is missing the application refuses, loudly, naming the
 * variables it wants.
 *
 * The fixture session survives for tests and for the visual work of #11, which
 * inject it directly. What it no longer has is a route into a running
 * application: nothing this function can return lists a human to become.
 */
export function chooseWorkplaceSession({ env }: SessionChoice): WorkplaceSession {
  const config = readAuth0Config(env)

  return createAuth0WorkplaceSession(
    new Auth0ClientAdapter(
      new Auth0SpaClient({
        domain: config.domain,
        clientId: config.clientId,
        authorizationParams: { redirect_uri: config.callback },
        useRefreshTokens: true,
      }),
      config.callback,
      new URL(config.callback).origin,
    ),
    createColonyHumanDirectory(),
  )
}

export function createWorkplaceSession(): WorkplaceSession {
  return chooseWorkplaceSession({
    env: import.meta.env as unknown as Record<string, string | undefined>,
  })
}

export function provideWorkplaceSession(session?: WorkplaceSession): WorkplaceSession {
  const chosen = session ?? createWorkplaceSession()

  provide(WORKPLACE_SESSION, chosen)

  return chosen
}
