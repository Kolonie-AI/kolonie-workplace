import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

/**
 * Comments name Vikunja sources and the write path. The rules below are
 * about what the pane does, so they read the code with the comments removed.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
}

const pane = withoutComments(
  readFileSync(resolve(root, 'src/detail/DetailPane.vue'), 'utf8'),
)
const composable = withoutComments(
  readFileSync(resolve(root, 'src/detail/use-item-detail.ts'), 'utf8'),
)
const styles = withoutComments(
  readFileSync(resolve(root, 'src/detail/detail-pane.css'), 'utf8'),
)

describe('detail source — writes through the parent, never a gateway of its own', () => {
  it('emits an update and never talks to a gateway', () => {
    expect(pane).toMatch(/emit\('update'/)
    expect(pane).not.toMatch(/useTaskGateway|getItemDetail|getBoardItems|updateWorkItem/)
  })

  it('sanitises description markup before it is written', () => {
    expect(pane).toMatch(/sanitizeDescription/)
  })
})

describe('detail source — the detail is fetched, never taken from the board payload', () => {
  it('loads through the gateway detail call and nothing else', () => {
    expect(composable).toMatch(/gateway\.getItemDetail/)
    expect(composable).not.toMatch(/getBoardItems/)
  })
})

describe('detail source — original code, not a Vikunja port', () => {
  it('names no Vikunja module, file, class or asset', () => {
    for (const source of [pane, composable, styles]) {
      expect(source).not.toMatch(/vikunja/i)
      expect(source).not.toMatch(/TaskDetailView/i)
      expect(source).not.toMatch(/\bis-(loading|active|done)\b/)
      expect(source).not.toMatch(/\bbucket\b|\btask-id\b|\bITask\b/i)
    }
  })

  it('keeps the Colony owner field beside the assignee list', () => {
    expect(pane).toMatch(/owner/i)
    expect(pane).toMatch(/assignee/i)
  })
})

describe('detail styles', () => {
  it('uses design tokens instead of literal colour values', () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(styles).toContain('var(--color-border)')
    expect(styles).toContain('var(--color-surface)')
  })
})
