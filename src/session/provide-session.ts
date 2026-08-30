import { provide } from 'vue'
import { Auth0Client as Auth0SpaClient } from '@auth0/auth0-spa-js'
import { Auth0ClientAdapter } from '@/session/auth0-client-adapter'
import { createAuth0WorkplaceSession } from '@/session/auth0-workplace-session'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import {
  isWorkplaceConfigAbsent,
  readLiveWorkplaceConfig,
} from '@/session/live-config'
import { createWorkplaceMeClient } from '@/session/workplace-me'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

/**
 * The single composition point where an implementation of the session port is
 * chosen. No shell or board component moved to introduce the real login: they
 * resolve the port and never an implementation of it.
 */
export interface SessionChoice {
  readonly env: Readonly<Record<string, string | undefined>>
}

export function chooseWorkplaceSession({ env }: SessionChoice): WorkplaceSession {
  if (isWorkplaceConfigAbsent(env)) {
    return createFixtureWorkplaceSession()
  }

  const config = readLiveWorkplaceConfig(env)
  const sdk = new Auth0SpaClient({
    domain: config.domain,
    clientId: config.clientId,
    authorizationParams: {
      redirect_uri: config.callback,
      audience: config.audience,
    },
    cacheLocation: 'memory',
    useRefreshTokens: true,
  })
  const client = new Auth0ClientAdapter(
    sdk,
    config.callback,
    new URL(config.callback).origin,
    config.audience,
  )

  return createAuth0WorkplaceSession(
    client,
    createWorkplaceMeClient({ origin: config.platformOrigin }),
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
