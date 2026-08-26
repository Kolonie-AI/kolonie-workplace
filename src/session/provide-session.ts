import { provide } from 'vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

/**
 * The single composition point where an implementation of the session port is
 * chosen. Introducing a real login is a change to this file and to the
 * implementation it names; no shell or board component moves.
 */
export function createWorkplaceSession(): WorkplaceSession {
  return createFixtureWorkplaceSession()
}

export function provideWorkplaceSession(
  session: WorkplaceSession = createWorkplaceSession(),
): WorkplaceSession {
  provide(WORKPLACE_SESSION, session)

  return session
}
