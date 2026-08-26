import type { Human } from '@/domain/workplace'
import type { WorkplaceSession } from '@/session/workplace-session'

/**
 * A development-only extension of the session port: an implementation that can
 * list the humans it will sign in without any credential.
 *
 * The fixture session implements it; a real login implementation must not, and
 * the signed-out view then offers no picker at all.
 */
export interface DevelopmentSignIn {
  readonly isDevelopmentAffordance: true
  listSignInCandidates(): readonly Human[]
}

export function asDevelopmentSignIn(
  session: WorkplaceSession,
): (WorkplaceSession & DevelopmentSignIn) | null {
  const candidate = session as WorkplaceSession & Partial<DevelopmentSignIn>

  return candidate.isDevelopmentAffordance === true &&
    typeof candidate.listSignInCandidates === 'function'
    ? (candidate as WorkplaceSession & DevelopmentSignIn)
    : null
}
