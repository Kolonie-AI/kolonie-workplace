import type { InjectionKey, Ref } from 'vue'
import type { Human, HumanId } from '@/domain/workplace'

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

export interface WorkplaceSession {
  readonly currentHuman: Readonly<Ref<Human | null>>
  signIn(request: SignInRequest): Promise<void>
  signOut(): Promise<void>
}

export const WORKPLACE_SESSION: InjectionKey<WorkplaceSession> = Symbol('workplaceSession')
