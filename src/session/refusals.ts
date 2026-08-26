import type { HumanId } from '@/domain/workplace'

/**
 * A sign-in for a human the session cannot resolve is refused. It is never
 * answered with a default human, and never with another human.
 */
export class SignInRefused extends Error {
  readonly humanId: HumanId

  constructor(humanId: HumanId) {
    super('Kolonie Workplace: that human cannot be signed in.')
    this.name = 'SignInRefused'
    this.humanId = humanId
  }
}
