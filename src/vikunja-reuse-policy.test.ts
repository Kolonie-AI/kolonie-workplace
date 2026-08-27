import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readRootFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const AGENTS = readRootFile('AGENTS.md')
const README = readRootFile('README.md')
const NOTICE = readRootFile('NOTICE')

/**
 * The blanket prohibition this repository carried until 2026-08-27, in the
 * wordings it actually used. A future edit that reintroduces any of them
 * contradicts the maintainer decision recorded in `AGENTS.md` §5 — and would do
 * so silently, because prose has no compiler. This file is that compiler.
 *
 * These are deliberately phrase-level rather than keyword-level: "no Vikunja
 * source" must fail, while "Vikunja source may be imported or adapted" must
 * not. A test that rejected the word `Vikunja` would reject the permission
 * along with the ban.
 */
const REINSTATED_PROHIBITIONS = [
  /no\s+Vikunja\s+source\s+(?:file\s+)?is\s+ever\s+imported/i,
  /No\s+Vikunja\s+source\s+in\s+this\s+repository/i,
  /copy\s+no\s+source\s+file/i,
  /Vikunja\s+is\s+read\s+for\s+shape\s+only/i,
  /and\s+by\s+nothing\s+else/i,
] as const

describe('Vikunja reuse policy — the 2026-08-27 permission is what the documents say', () => {
  it.each([
    ['AGENTS.md', AGENTS],
    ['README.md', README],
    ['NOTICE', NOTICE],
  ])('%s does not reinstate the blanket import ban', (_name, text) => {
    for (const prohibition of REINSTATED_PROHIBITIONS) {
      expect(text).not.toMatch(prohibition)
    }
  })

  it('AGENTS.md permits import or adaptation rather than only reading for shape', () => {
    expect(AGENTS).toMatch(/Vikunja source may be imported or adapted, with attribution/i)
    expect(AGENTS).toMatch(/Selective Vikunja reuse is permitted/i)
  })

  it('AGENTS.md keeps the three attribution duties that make reuse honest', () => {
    expect(AGENTS).toMatch(/upstream copyright and licence header intact/i)
    expect(AGENTS).toMatch(/NOTICE.*pinned upstream release and commit/is)
    expect(AGENTS).toMatch(/names the source paths/i)
  })

  it('AGENTS.md keeps the 2026-08-25 coupling measurement as a warning, not as a ban', () => {
    expect(AGENTS).toMatch(/2026-08-25 measurement still stands/i)
    expect(AGENTS).toMatch(/Pinia stores, HTTP\s+services, `vue-router`, `vue-i18n` and a 35-field `ITask`/i)
    expect(AGENTS).toMatch(/wholesale copy of the tree is the wrong shape/i)
  })

  it('AGENTS.md keeps the Colony boundaries the licence change does not touch', () => {
    expect(AGENTS).toMatch(/Colony domain does not come\s+from Vikunja's `ITask`/i)
    expect(AGENTS).toMatch(/Canonical work state stays in `kolonie-platform`/i)
    expect(AGENTS).toMatch(/`TaskGateway` remains the only seam/i)
  })

  it('README.md states the same rule as AGENTS.md rather than the superseded one', () => {
    expect(README).toMatch(/source may be copied or adapted\s+with attribution/i)
    expect(README).toMatch(/What that permission does \*not\* cover is a fork/i)
  })

  it('NOTICE carries an attribution inventory that an import has to extend', () => {
    expect(NOTICE).toMatch(/Imported or adapted from Vikunja:/i)
    expect(NOTICE).toMatch(/upstream release, the\s+commit it was taken from, and the paths it affects/i)
  })

  /**
   * The negative criterion. `NOTICE` claims nothing has been imported yet, and
   * that claim ages badly on its own: the first import that forgets its row
   * leaves the file confidently wrong. So the emptiness is asserted against the
   * tree rather than trusted — if a Vikunja copyright header appears in `src/`,
   * this fails until the inventory names it.
   */
  it('fails if Vikunja-attributed source exists while NOTICE still says none was imported', async () => {
    const { globSync } = await import('node:fs')
    const sources = (globSync('src/**/*.{ts,vue,css}', { cwd: process.cwd() }) as string[]).filter(
      // This file names Vikunja and the word `copyright` in order to police
      // them, so it matches its own heuristic. Excluding it keeps the check
      // about imported source rather than about itself.
      (path) => path !== 'src/vikunja-reuse-policy.test.ts',
    )

    const attributed = sources.filter((path) => {
      const text = readFileSync(resolve(process.cwd(), path), 'utf8')
      return /Vikunja/i.test(text) && /copyright|SPDX-License-Identifier/i.test(text)
    })

    const inventoryIsEmpty = /Imported or adapted from Vikunja:\s*\n\s*\(none yet\)/.test(NOTICE)

    if (inventoryIsEmpty) {
      expect(attributed).toEqual([])
    } else {
      for (const path of attributed) {
        expect(NOTICE).toContain(path)
      }
    }
  })
})
