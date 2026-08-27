import { describe, expect, it } from 'vitest'
import { FIXTURE_HUMANS, FIXTURE_IDENTITIES, fixtureHumans } from '@/fixtures/catalogue'
import {
  createColonyHumanDirectory,
  createFixtureHumanDirectory,
  PREVIEW_HUMAN_ID,
} from '@/session/colony-human-directory'
import { MissingPreviewIdentityConfiguration } from '@/session/preview-identity'

/**
 * The configured pair stands in for the maintainer's real preview identity. It
 * is fictional on purpose: the real provider and subject arrive from the
 * environment at build time and are never written down here, which is the whole
 * point of the adapter under test.
 */
const CONFIGURED = {
  VITE_PREVIEW_IDENTITY_PROVIDER: 'configured-provider',
  VITE_PREVIEW_IDENTITY_SUBJECT: 'configured-subject',
} as const

describe('the configured preview identity resolves to a fixture human that owns boards', () => {
  it('resolves the configured (provider, subject) pair to the preview human', async () => {
    const directory = createColonyHumanDirectory(CONFIGURED)

    const human = await directory.resolve('configured-provider', 'configured-subject')

    expect(human?.id).toBe(PREVIEW_HUMAN_ID)
  })

  it('maps to a human the fixture catalogue already holds, never to a new one', async () => {
    const directory = createColonyHumanDirectory(CONFIGURED)
    const known = new Set(fixtureHumans.map((human) => human.id))

    const human = await directory.resolve('configured-provider', 'configured-subject')

    expect(human).not.toBeNull()
    expect(known.has(human?.id ?? '')).toBe(true)
  })

  it('maps to a human that owns at least one agent, so boards are visible', () => {
    const preview = fixtureHumans.find((human) => human.id === PREVIEW_HUMAN_ID)

    expect(preview).toBeDefined()
    expect(preview?.agentIds.length).toBeGreaterThan(0)
  })

  it('keeps the fictional fixture identities working alongside it', async () => {
    const directory = createColonyHumanDirectory(CONFIGURED)

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
  })
})

describe('rejection: an identity that is not the configured one is refused', () => {
  it('refuses the configured subject presented under another provider', async () => {
    const directory = createColonyHumanDirectory(CONFIGURED)

    expect(
      await directory.resolve('another-provider', 'configured-subject'),
    ).toBeNull()
  })

  it('refuses another subject presented under the configured provider', async () => {
    const directory = createColonyHumanDirectory(CONFIGURED)

    expect(
      await directory.resolve('configured-provider', 'another-subject'),
    ).toBeNull()
  })

  it('refuses an unconfigured real identity outright, with no wildcard', async () => {
    const directory = createColonyHumanDirectory(CONFIGURED)

    for (const [provider, subject] of [
      ['configured-provider', ''],
      ['', 'configured-subject'],
      ['*', '*'],
      ['configured-provider', 'configured-subject-with-a-suffix'],
      ['configured-provider-with-a-suffix', 'configured-subject'],
    ] as const) {
      expect(await directory.resolve(provider, subject)).toBeNull()
    }
  })

  it('matches nothing on an address, so an email-only match cannot let anybody in', async () => {
    const directory = createColonyHumanDirectory(CONFIGURED)

    expect(
      await directory.resolve('configured-provider', 'someone@example.invalid'),
    ).toBeNull()
  })

  it('adds exactly one identity and creates no account for anybody else', async () => {
    const directory = createColonyHumanDirectory(CONFIGURED)
    const fixtureOnly = createFixtureHumanDirectory()

    expect(
      await fixtureOnly.resolve('configured-provider', 'configured-subject'),
    ).toBeNull()
    expect(await directory.resolve('configured-provider', 'configured-subject'))
      .not.toBeNull()
  })
})

describe('rejection: a missing or partial mapping refuses rather than broadening access', () => {
  it('refuses to build a directory at all when the mapping is absent', () => {
    expect(() => createColonyHumanDirectory({})).toThrow(
      MissingPreviewIdentityConfiguration,
    )
  })

  it.each([
    'VITE_PREVIEW_IDENTITY_PROVIDER',
    'VITE_PREVIEW_IDENTITY_SUBJECT',
  ])('refuses a mapping missing %s rather than matching on the half it has', (missing) => {
    const partial: Record<string, string> = { ...CONFIGURED }
    delete partial[missing]

    expect(() => createColonyHumanDirectory(partial)).toThrow(
      MissingPreviewIdentityConfiguration,
    )
  })

  it('refuses an empty half, so a blank value never matches a blank claim', () => {
    expect(() =>
      createColonyHumanDirectory({ ...CONFIGURED, VITE_PREVIEW_IDENTITY_SUBJECT: '  ' }),
    ).toThrow(MissingPreviewIdentityConfiguration)
  })
})

describe('the preview mapping names no identity in the repository', () => {
  it('holds no configured provider or subject of its own', async () => {
    const directory = createColonyHumanDirectory(CONFIGURED)
    const resolved = await Promise.all(
      Object.values(FIXTURE_IDENTITIES).map((identity) =>
        directory.resolve(identity.provider, identity.subject),
      ),
    )

    expect(resolved.every((human) => human !== null)).toBe(true)
  })

  it('never answers with an agent id, preview mapping or not', async () => {
    const directory = createColonyHumanDirectory(CONFIGURED)

    for (const agentId of fixtureHumans.flatMap((human) => human.agentIds)) {
      expect(await directory.resolve('configured-provider', agentId)).toBeNull()
    }
  })
})
