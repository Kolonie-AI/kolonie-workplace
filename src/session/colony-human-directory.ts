import type { Human } from '@/domain/workplace'
import {
  FIXTURE_HUMANS,
  FIXTURE_IDENTITIES,
  fixtureHumans,
} from '@/fixtures/catalogue'
import type { HumanDirectory } from '@/session/human-directory'

/**
 * Resolution of `(provider, subject)` to an existing human.
 *
 * **This is the first cut's directory, and it is fixture-backed by decision.**
 * The package it belongs to is *frontend, login and mock data*: the Colony's
 * `humans` table lives in `kolonie-platform` and the workplace has no client
 * for it, because how this SPA proves a human to the API is an open question
 * (`kolonie-docs#506`) that must not be pre-empted by an HTTP call invented
 * here. So the fixture catalogue stands in for the Colony's rows exactly as it
 * stands in for its boards.
 *
 * What is **not** fixture-shaped is the contract, and that is the part a real
 * implementation keeps:
 *
 * - the key is `(provider, subject)` and both halves must match, so a subject
 *   presented under the wrong provider resolves to nobody;
 * - one human may hold several identities, because a person who signs in with
 *   Google today and GitHub tomorrow is one person and must not be given a
 *   second account;
 * - nothing is ever created here. An identity with no human is refused, and a
 *   refusal is the answer — a workplace does not mint human identity, which is
 *   the decision `a-human-account-is-a-login` records;
 * - an agent id is not a human and can never be returned as one.
 *
 * A real implementation replaces this file and nothing else.
 */
export interface KnownIdentity {
  readonly provider: string
  readonly subject: string
  readonly humanId: string
}

export class ColonyHumanDirectory implements HumanDirectory {
  readonly #identities: readonly KnownIdentity[]
  readonly #humans: readonly Human[]

  constructor(identities: readonly KnownIdentity[], humans: readonly Human[]) {
    this.#identities = identities
    this.#humans = humans
  }

  async resolve(provider: string, subject: string): Promise<Human | null> {
    if (provider === '' || subject === '') {
      return null
    }

    const identity = this.#identities.find(
      (candidate) => candidate.provider === provider && candidate.subject === subject,
    )

    if (identity === undefined) {
      return null
    }

    return this.#humans.find((human) => human.id === identity.humanId) ?? null
  }
}

const FIXTURE_KNOWN_IDENTITIES: readonly KnownIdentity[] = [
  { ...FIXTURE_IDENTITIES.wren, humanId: FIXTURE_HUMANS.wren },
  { ...FIXTURE_IDENTITIES.wrenSecondDoor, humanId: FIXTURE_HUMANS.wren },
  { ...FIXTURE_IDENTITIES.ash, humanId: FIXTURE_HUMANS.ash },
  { ...FIXTURE_IDENTITIES.rook, humanId: FIXTURE_HUMANS.rook },
]

export function createColonyHumanDirectory(): HumanDirectory {
  return new ColonyHumanDirectory(FIXTURE_KNOWN_IDENTITIES, fixtureHumans)
}

export function createFixtureHumanDirectory(): HumanDirectory {
  return createColonyHumanDirectory()
}
