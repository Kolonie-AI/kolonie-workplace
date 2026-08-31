import type { InjectionKey, Ref } from 'vue'
import type { Human, HumanId } from '@/domain/workplace'

export interface LinkedCitizen {
  readonly id: string
  readonly handle: string
  readonly status: string
}

/**
 * The port the workplace signs in through.
 *
 * It is an interface on purpose: the fixture picker delivered with this issue
 * is one implementation behind it, and a real login arrives later as another.
 * Shell and board components depend on this file, never on an implementation.
 */
export interface SignInRequest {
  readonly humanId: HumanId
}

/**
 * `signIn` takes an optional request because the two implementations of this
 * port are asked for different things. The development picker is told *which*
 * human to become, since it has no credential to go on. A federated login is
 * told nothing: who you are is what the hosted login establishes, and a
 * workplace that could name the human to sign in would be a workplace that
 * could sign in as anybody.
 *
 * The port itself stays free of authentication machinery — no token, no
 * provider, no subject appears here. Those belong to the implementation.
 */
export type WorkplaceSessionFailure = 'unauthorized' | 'forbidden'

export interface WorkplaceSession {
  readonly currentHuman: Readonly<Ref<Human | null>>
  signIn(request?: SignInRequest): Promise<void>
  signOut(): Promise<void>
  readonly linkedAgents?: Readonly<Ref<readonly LinkedCitizen[] | null>>
  readonly failure?: Readonly<Ref<WorkplaceSessionFailure | null>>
  pickCitizen?(citizenId: string): void
  switchCitizen?(): void
  getAccessToken?(): Promise<string>
  invalidateAuthentication(): void
}

export const WORKPLACE_SESSION: InjectionKey<WorkplaceSession> = Symbol('workplaceSession')
