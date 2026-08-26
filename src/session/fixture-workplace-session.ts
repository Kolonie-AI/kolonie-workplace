import { ref, type Ref } from 'vue'
import type { Human } from '@/domain/workplace'
import { fixtureHumans } from '@/fixtures/catalogue'
import type { DevelopmentSignIn } from '@/session/development-sign-in'
import { SignInRefused } from '@/session/refusals'
import type { SignInRequest, WorkplaceSession } from '@/session/workplace-session'

/**
 * The development sign-in: it picks one of the fixture humans and holds it in
 * memory for the life of the page. That is the whole of what it does — no
 * credential, no persistence, nothing sent anywhere.
 *
 * This file is the one a later issue replaces to introduce a real login.
 */
export const fixtureSignInCandidates: readonly Human[] = fixtureHumans

export class FixtureWorkplaceSession implements WorkplaceSession, DevelopmentSignIn {
  readonly isDevelopmentAffordance = true as const

  readonly #human: Ref<Human | null> = ref(null)

  readonly currentHuman: Readonly<Ref<Human | null>> = this.#human

  listSignInCandidates(): readonly Human[] {
    return fixtureSignInCandidates
  }

  async signIn(request?: SignInRequest): Promise<void> {
    const humanId = request?.humanId

    if (humanId === undefined) {
      throw new SignInRefused('')
    }

    const human = fixtureSignInCandidates.find((candidate) => candidate.id === humanId)

    if (human === undefined) {
      throw new SignInRefused(humanId)
    }

    this.#human.value = human
  }

  async signOut(): Promise<void> {
    this.#human.value = null
  }
}

export function createFixtureWorkplaceSession(): WorkplaceSession & DevelopmentSignIn {
  return new FixtureWorkplaceSession()
}
