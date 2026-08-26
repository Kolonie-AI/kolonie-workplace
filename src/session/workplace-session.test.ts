import { describe, expect, it } from 'vitest'
import { FIXTURE_HUMANS } from '@/fixtures/catalogue'
import {
  createFixtureWorkplaceSession,
  fixtureSignInCandidates,
} from '@/session/fixture-workplace-session'
import { SignInRefused } from '@/session/refusals'
import type { WorkplaceSession } from '@/session/workplace-session'

describe('fixture workplace session — the port it implements', () => {
  it('starts signed out, holding no human at all', () => {
    const session: WorkplaceSession = createFixtureWorkplaceSession()

    expect(session.currentHuman.value).toBeNull()
  })

  it('signs in the fixture human that was asked for, and no other', async () => {
    const session = createFixtureWorkplaceSession()

    await session.signIn({ humanId: FIXTURE_HUMANS.ash })

    expect(session.currentHuman.value?.id).toBe(FIXTURE_HUMANS.ash)
    expect(session.currentHuman.value?.name).toBe('Fictional Human Ash')
  })

  it('swaps the signed-in human when a second sign-in is asked for', async () => {
    const session = createFixtureWorkplaceSession()

    await session.signIn({ humanId: FIXTURE_HUMANS.ash })
    await session.signIn({ humanId: FIXTURE_HUMANS.wren })

    expect(session.currentHuman.value?.id).toBe(FIXTURE_HUMANS.wren)
  })

  it('leaves no usable session behind after sign-out', async () => {
    const session = createFixtureWorkplaceSession()

    await session.signIn({ humanId: FIXTURE_HUMANS.wren })
    await session.signOut()

    expect(session.currentHuman.value).toBeNull()
  })

  it('offers every fixture human as a development sign-in candidate', () => {
    expect(fixtureSignInCandidates.map((human) => human.id)).toEqual([
      FIXTURE_HUMANS.wren,
      FIXTURE_HUMANS.ash,
      FIXTURE_HUMANS.rook,
    ])
  })

  it('holds no credential, token or persisted value of any kind', async () => {
    const session = createFixtureWorkplaceSession()

    await session.signIn({ humanId: FIXTURE_HUMANS.wren })

    expect(Object.keys(globalThis.localStorage)).toEqual([])
    expect(Object.keys(globalThis.sessionStorage)).toEqual([])
    expect(JSON.stringify(session.currentHuman.value)).not.toMatch(/token|password|secret/i)
  })
})

describe('fixture workplace session — rejection: a human the catalogue does not know', () => {
  it('refuses the sign-in instead of inventing or defaulting a human', async () => {
    const session = createFixtureWorkplaceSession()

    await expect(session.signIn({ humanId: 'fictional-human-nobody' })).rejects.toBeInstanceOf(
      SignInRefused,
    )
  })

  it('stays signed out after a refused sign-in', async () => {
    const session = createFixtureWorkplaceSession()

    await session.signIn({ humanId: FIXTURE_HUMANS.wren }).catch(() => undefined)
    await session.signIn({ humanId: 'fictional-human-nobody' }).catch(() => undefined)

    expect(session.currentHuman.value?.id).toBe(FIXTURE_HUMANS.wren)

    const fresh = createFixtureWorkplaceSession()
    await fresh.signIn({ humanId: 'fictional-human-nobody' }).catch(() => undefined)

    expect(fresh.currentHuman.value).toBeNull()
  })
})
