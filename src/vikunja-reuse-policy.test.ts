import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readRootFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const AGENTS = readRootFile('AGENTS.md')
const README = readRootFile('README.md')
const NOTICE = readRootFile('NOTICE')
const LICENSE = readRootFile('LICENSE')
const TRELLO_REFERENCE = readRootFile('docs/trello-reference.md')

/**
 * Operator decision 2026-08-28: Vikunja is a rejected former reference.
 * The 2026-08-27 permission this file used to enforce is now the bug. A
 * future edit that re-permits import, names a Vikunja commit, lists adapted
 * paths, or puts a Vikunja copyright header back under `src/` must fail here.
 *
 * This file is the one place under `src/` allowed to name Vikunja, because it
 * is the compiler for the prohibition.
 */
const REINSTATED_PERMISSIONS = [
  /Vikunja source may be imported or adapted/i,
  /Selective Vikunja reuse is permitted/i,
  /source may be copied or adapted\s+with attribution/i,
  /permits copying and adapting Vikunja source/i,
  /Imported or adapted from Vikunja/i,
] as const

const POLICY_TEST = 'src/vikunja-reuse-policy.test.ts'

describe('Vikunja reuse policy — the 2026-08-28 prohibition is what the documents say', () => {
  it.each([
    ['AGENTS.md', AGENTS],
    ['README.md', README],
    ['NOTICE', NOTICE],
  ])('%s does not re-permit Vikunja import or adaptation', (_name, text) => {
    for (const permission of REINSTATED_PERMISSIONS) {
      expect(text).not.toMatch(permission)
    }
  })

  it('NOTICE does not inventory Vikunja-adapted paths or name a Vikunja commit', () => {
    expect(NOTICE).not.toMatch(/Imported or adapted from Vikunja/i)
    expect(NOTICE).not.toMatch(/go-vikunja/i)
    expect(NOTICE).not.toMatch(/ef2200e/i)
    expect(NOTICE).not.toMatch(/Release 2\.5\.0/i)
    expect(NOTICE).not.toMatch(/frontend\/src\//)
  })

  it('AGENTS.md forbids Vikunja reuse and names it only as a rejected former reference', () => {
    expect(AGENTS).toMatch(/Vikunja reuse is forbidden/i)
    expect(AGENTS).toMatch(/rejected former reference/i)
    expect(AGENTS).not.toMatch(/Vikunja source may be imported or adapted, with attribution/i)
    expect(AGENTS).not.toMatch(/Selective Vikunja reuse is permitted/i)
  })

  it('README.md states the same prohibition rather than the 2026-08-27 permission', () => {
    expect(README).toMatch(/Vikunja reuse is forbidden/i)
    expect(README).not.toMatch(/source may be copied or adapted\s+with attribution/i)
  })

  it('AGENTS.md §5 and the Trello reference keep the three durable facts', () => {
    const sectionFive = AGENTS.slice(AGENTS.indexOf('## 5.'))

    expect(sectionFive).toContain('docs/trello-reference.md')
    expect(sectionFive).toMatch(/do not copy Trello source/i)
    expect(sectionFive).toMatch(/Hermes/)
    expect(sectionFive).toMatch(/lifecycle/)
    expect(sectionFive).toMatch(/trello\/colette-reprise/)

    expect(TRELLO_REFERENCE).toMatch(/appearance and interactions/i)
    expect(TRELLO_REFERENCE).toMatch(/Hermes/)
    expect(TRELLO_REFERENCE).toMatch(/lifecycle/)
    expect(TRELLO_REFERENCE).toMatch(/trello\/colette-reprise/)
    expect(TRELLO_REFERENCE).not.toMatch(/https?:\/\/trello\.com\/b\//i)
  })

  it('LICENSE remains AGPL-3.0-or-later for this network-facing Colony app', () => {
    expect(LICENSE).toMatch(/GNU AFFERO GENERAL PUBLIC LICENSE/)
    expect(NOTICE).toMatch(/AGPL-3\.0-or-later/)
    expect(NOTICE).toMatch(/network-facing Colony application/)
    expect(NOTICE).not.toMatch(/because of Vikunja/i)
  })

  it('fails if any src file still carries a Vikunja copyright header', async () => {
    const { globSync } = await import('node:fs')
    const sources = (globSync('src/**/*.{ts,vue,css}', { cwd: process.cwd() }) as string[]).filter(
      (path) => path !== POLICY_TEST,
    )

    const attributed = sources.filter((path) => {
      const text = readFileSync(resolve(process.cwd(), path), 'utf8')
      return /Copyright/i.test(text) && /Vikunja|go-vikunja/i.test(text)
    })

    expect(attributed).toEqual([])
  })
})
