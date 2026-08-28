import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readRootFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const REFERENCE_PATH = 'docs/trello-reference.md'

/**
 * Package #83 is a written measurement, not a restyle. The document is the
 * contract later children implement against. A worker must be able to build
 * #75 from it without opening Trello, and must not read it as permission to
 * copy Trello source.
 */
describe('docs/trello-reference.md — measured Trello MVP baseline', () => {
  it('exists at the path later issues cite', () => {
    expect(existsSync(resolve(process.cwd(), REFERENCE_PATH))).toBe(true)
  })

  it('carries the access note, measurement date, file matrix, MVP/deferred tables and state machines', () => {
    const text = readRootFile(REFERENCE_PATH)

    expect(text).toMatch(/trello\/colette-reprise/)
    expect(text).toMatch(/2026-08-28/)
    expect(text).toMatch(/Camofox/)
    expect(text).toMatch(/## File matrix/)
    expect(text).toMatch(/src\/kanban\/KanbanBoard\.vue/)
    expect(text).toMatch(/src\/kanban\/KanbanCard\.vue/)
    expect(text).toMatch(/src\/kanban\/LaneComposer\.vue/)
    expect(text).toMatch(/src\/detail\/DetailPane\.vue/)
    expect(text).toMatch(/src\/gateway\/task-gateway\.ts/)
    expect(text).toMatch(/src\/items\/board-filter\.ts/)
    expect(text).toMatch(/## MVP/)
    expect(text).toMatch(/## Deferred/)
    expect(text).toMatch(/## Add-card state machine/)
    expect(text).toMatch(/## Open-close state machine/)
    expect(text).toMatch(/## Move state machine/)
    expect(text).toMatch(/## Filter state machine/)
    expect(text).toMatch(/#75/)
    expect(text).toMatch(/#76/)
    expect(text).toMatch(/#77/)
    expect(text).toMatch(/#78/)
    expect(text).toMatch(/#79/)
    expect(text).toMatch(/#80/)
    expect(text).toMatch(/#81/)
    expect(text).toMatch(/#82/)
    expect(text).toMatch(/#74/)
  })

  it('records the three durable facts without a secret or private board URL', () => {
    const text = readRootFile(REFERENCE_PATH)

    expect(text).toMatch(/appearance and interactions/i)
    expect(text).toMatch(/Hermes/)
    expect(text).toMatch(/lifecycle/)
    expect(text).toMatch(/trello\/colette-reprise/)
    expect(text).not.toMatch(/https?:\/\/trello\.com\/b\//i)
    expect(text).not.toMatch(/password\s*[:=]/i)
    expect(text).not.toMatch(/otp\s*[:=]/i)
    expect(text).not.toMatch(/cookie\s*[:=]/i)
    expect(text).not.toMatch(/token\s*[:=]/i)
  })

  it('forbids copying Trello CSS, source, assets, logos or proprietary copy', () => {
    const text = readRootFile(REFERENCE_PATH)

    expect(text).toMatch(/do not copy Trello source/i)
    expect(text).toMatch(/CSS/)
    expect(text).toMatch(/assets/)
    expect(text).toMatch(/logos/)
    expect(text).toMatch(/proprietary copy/i)

    const PERMISSIVE_TRELLO_COPY = [
      /Trello source may be (?:imported|copied|adapted)/i,
      /(?:may|can|should) copy Trello (?:CSS|source|assets)/i,
      /import Trello (?:CSS|source|assets)/i,
      /copying Trello (?:CSS|source|assets) is permitted/i,
    ] as const

    for (const permission of PERMISSIVE_TRELLO_COPY) {
      expect(text).not.toMatch(permission)
    }
  })

  it('keeps the six lifecycle lanes and refuses a seventh list', () => {
    const text = readRootFile(REFERENCE_PATH)

    expect(text).toMatch(/inbox/)
    expect(text).toMatch(/ready/)
    expect(text).toMatch(/in_progress/)
    expect(text).toMatch(/blocked/)
    expect(text).toMatch(/review/)
    expect(text).toMatch(/done/)
    expect(text).toMatch(/must not grow a seventh list/i)
    expect(text).toMatch(/lists do not drag/i)
    expect(text).toMatch(/Done lane/i)
  })
})

describe('AGENTS.md and README.md point at the measured Trello reference', () => {
  it('AGENTS.md §5 links docs/trello-reference.md', () => {
    const agents = readRootFile('AGENTS.md')
    const sectionFive = agents.slice(agents.indexOf('## 5.'))

    expect(sectionFive).toContain('docs/trello-reference.md')
    expect(sectionFive).toMatch(/do not copy Trello source/i)
  })

  it('README.md links docs/trello-reference.md', () => {
    const readme = readRootFile('README.md')

    expect(readme).toContain('docs/trello-reference.md')
  })
})
