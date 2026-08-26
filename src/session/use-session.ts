import { computed, inject, type ComputedRef } from 'vue'
import type { Human } from '@/domain/workplace'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

/**
 * The one way a component reaches the session: the port is resolved, never an
 * implementation of it. A tree with no session provided reads as signed out,
 * which is deliberate — an absent session must produce the signed-out state
 * rather than a default human.
 */
export function useOptionalWorkplaceSession(): WorkplaceSession | null {
  return inject(WORKPLACE_SESSION, null)
}

export function useWorkplaceSession(): WorkplaceSession {
  const session = useOptionalWorkplaceSession()

  if (session === null) {
    throw new Error('Kolonie Workplace: no WorkplaceSession was provided to this component.')
  }

  return session
}

export function useSignedInHuman(): ComputedRef<Human | null> {
  const session = useOptionalWorkplaceSession()

  return computed(() => session?.currentHuman.value ?? null)
}
