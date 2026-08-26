import { describe, expect, it } from 'vitest'
import { createFixtureHumanDirectory } from '@/session/colony-human-directory'
import { fixtureHumans, FIXTURE_HUMANS, FIXTURE_IDENTITIES } from '@/fixtures/catalogue'

describe('resolving a federated identity to an existing human', () => {
  it('resolves a known (provider, subject) pair to that human', async () => {
    const directory = createFixtureHumanDirectory()
    const wren = FIXTURE_IDENTITIES.wren

    const human = await directory.resolve(wren.provider, wren.subject)

    expect(human?.id).toBe(FIXTURE_HUMANS.wren)
  })

  it('gives each identity its own human', async () => {
    const directory = createFixtureHumanDirectory()

    const wren = await directory.resolve(
      FIXTURE_IDENTITIES.wren.provider,
      FIXTURE_IDENTITIES.wren.subject,
    )
    const ash = await directory.resolve(
      FIXTURE_IDENTITIES.ash.provider,
      FIXTURE_IDENTITIES.ash.subject,
    )

    expect(wren?.id).toBe(FIXTURE_HUMANS.wren)
    expect(ash?.id).toBe(FIXTURE_HUMANS.ash)
    expect(wren?.id).not.toBe(ash?.id)
  })

  it('lets one human arrive through either of two providers', async () => {
    const directory = createFixtureHumanDirectory()

    const throughGoogle = await directory.resolve(
      FIXTURE_IDENTITIES.wren.provider,
      FIXTURE_IDENTITIES.wren.subject,
    )
    const throughGithub = await directory.resolve(
      FIXTURE_IDENTITIES.wrenSecondDoor.provider,
      FIXTURE_IDENTITIES.wrenSecondDoor.subject,
    )

    expect(throughGithub?.id).toBe(throughGoogle?.id)
  })
})

describe('rejection: an identity the Colony holds no human for', () => {
  it('resolves an unknown subject to nobody', async () => {
    const directory = createFixtureHumanDirectory()

    expect(
      await directory.resolve(FIXTURE_IDENTITIES.wren.provider, 'subject-nobody-holds'),
    ).toBeNull()
  })

  it('never crosses the provider and the subject of two different identities', async () => {
    const directory = createFixtureHumanDirectory()

    expect(
      await directory.resolve(
        FIXTURE_IDENTITIES.ash.provider,
        FIXTURE_IDENTITIES.wren.subject,
      ),
    ).toBeNull()
  })

  it('resolves nothing for an empty provider or subject', async () => {
    const directory = createFixtureHumanDirectory()

    expect(await directory.resolve('', FIXTURE_IDENTITIES.wren.subject)).toBeNull()
    expect(await directory.resolve(FIXTURE_IDENTITIES.wren.provider, '')).toBeNull()
  })

  it('never answers with an agent id', async () => {
    const directory = createFixtureHumanDirectory()
    const agentIds = fixtureHumans.flatMap((human) => human.agentIds)

    for (const agentId of agentIds) {
      expect(await directory.resolve('fixture', agentId)).toBeNull()
      expect(await directory.resolve('github', agentId)).toBeNull()
    }
  })

  it('resolves only to humans the fixture catalogue already holds', async () => {
    const directory = createFixtureHumanDirectory()
    const known = new Set(fixtureHumans.map((human) => human.id))

    for (const identity of Object.values(FIXTURE_IDENTITIES)) {
      const human = await directory.resolve(identity.provider, identity.subject)

      expect(human).not.toBeNull()
      expect(known.has(human?.id ?? '')).toBe(true)
    }
  })
})
