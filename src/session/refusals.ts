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

/**
 * A federated identity the Colony holds no `humans` row for is refused, and is
 * never answered with a default human or with a newly created one. The
 * workplace does not mint human identity.
 *
 * Neither refusal names the identity it refused. A message that echoed the
 * subject back would put an identifier from the login provider into whatever
 * the browser renders or logs, and it tells the person nothing they can act on.
 */
export class IdentityNotRecognised extends Error {
  constructor() {
    super(
      'Kolonie Workplace: that sign-in did not resolve to a Colony human account.',
    )
    this.name = 'IdentityNotRecognised'
  }
}
