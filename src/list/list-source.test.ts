import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

/**
 * The prose in these files explains why there is no sort control and no filter
 * bar, so it necessarily contains those words. The rules below are about what
 * the components do, so they read the code with the comments taken out.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
}

const view = withoutComments(readFileSync(resolve(root, 'src/list/ListView.vue'), 'utf8'))
const row = withoutComments(readFileSync(resolve(root, 'src/list/ListRow.vue'), 'utf8'))
const styles = withoutComments(readFileSync(resolve(root, 'src/list/list-view.css'), 'utf8'))

describe('list source — read-only by construction', () => {
  it('emits nothing that could write, reorder or change a status', () => {
    for (const source of [view, row]) {
      expect(source).not.toMatch(/emit\(\s*['"](update|move|reorder|create|delete|save|sort)/i)
      expect(source).not.toMatch(/v-model/)
      expect(source).not.toMatch(/contenteditable/i)
      expect(source).not.toMatch(/draggable/i)
    }
  })

  it('carries no sort, filter or column-configuration handler', () => {
    for (const source of [view, row]) {
      expect(source).not.toMatch(/@click\s*=\s*"[^"]*\b(sort|filter|configure)/i)
      expect(source).not.toMatch(/\.sort\(/)
      expect(source).not.toMatch(/<input|<select|<textarea/i)
    }
  })

  it('does not fetch: it renders the rows it is given', () => {
    for (const source of [view, row]) {
      expect(source).not.toMatch(/useTaskGateway|getBoardItems|getItemDetail/)
      expect(source).not.toMatch(/useBoardItems/)
    }
  })
})

describe('list source — original code, not a Vikunja port', () => {
  it('names no Vikunja module, file, class or asset', () => {
    for (const source of [view, row, styles]) {
      expect(source).not.toMatch(/vikunja/i)
      expect(source).not.toMatch(/\bis-(loading|active|done)\b/)
      expect(source).not.toMatch(/\bbucket\b|\btask-id\b|\bITask\b/i)
    }
  })

  it('speaks of Colony lanes rather than user-defined buckets', () => {
    expect(view).toMatch(/lane/i)
    expect(view).not.toMatch(/bucket/i)
  })
})

describe('list styles', () => {
  it('uses design tokens instead of literal colour values', () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(styles).toContain('var(--color-accent)')
    expect(styles).toContain('var(--color-border)')
  })

  it('lays the rows out as one dense vertical column', () => {
    expect(styles).toMatch(/\.list-view__rows\s*\{[^}]*display:\s*grid/s)
    expect(styles).not.toMatch(/\.list-view__rows\s*\{[^}]*grid-auto-flow:\s*column/s)
  })

  it('collapses to a narrower row at a narrow viewport', () => {
    expect(styles).toMatch(/@media\s*\(max-width:\s*48rem\)/)
  })
})
