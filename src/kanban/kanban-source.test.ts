import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

/**
 * The prose in these files explains why there is no drag handler and no
 * user-defined bucket, so it necessarily contains those words. The rules below
 * are about what the components do, so they read the code with the comments
 * taken out.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
}

const board = withoutComments(
  readFileSync(resolve(root, 'src/kanban/KanbanBoard.vue'), 'utf8'),
)
const card = withoutComments(
  readFileSync(resolve(root, 'src/kanban/KanbanCard.vue'), 'utf8'),
)
const styles = withoutComments(
  readFileSync(resolve(root, 'src/kanban/kanban-board.css'), 'utf8'),
)
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

const DRAG_LIBRARIES = [
  'vuedraggable',
  'sortablejs',
  'vue-draggable',
  'vue-draggable-next',
  'vue-slicksort',
  'vuedraggable-next',
  'dragula',
  'interactjs',
]

describe('kanban source — read-only by construction', () => {
  it('depends on no drag-and-drop library', () => {
    const declared = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    })

    for (const library of DRAG_LIBRARIES) {
      expect(declared).not.toContain(library)
    }
  })

  it('carries no draggable attribute and no drag or drop handler', () => {
    for (const source of [board, card]) {
      expect(source).not.toMatch(/draggable/i)
      expect(source).not.toMatch(/@drag|@drop|ondrag|ondrop|dragstart|dragover/i)
      expect(source).not.toMatch(/\bmove\b\s*[:=]/i)
    }
  })

  it('emits nothing that could write, reorder or change a status', () => {
    for (const source of [board, card]) {
      expect(source).not.toMatch(/emit\(\s*['"](update|move|reorder|create|delete|save)/i)
      expect(source).not.toMatch(/v-model/)
      expect(source).not.toMatch(/contenteditable/i)
    }
  })
})

describe('kanban source — original code, not a Vikunja port', () => {
  it('names no Vikunja module, file, class or asset', () => {
    for (const source of [board, card, styles]) {
      expect(source).not.toMatch(/vikunja/i)
      expect(source).not.toMatch(/\bis-(loading|active|done)\b/)
      expect(source).not.toMatch(/\bbucket\b|\btask-id\b|\bITask\b/i)
    }
  })

  it('speaks of Colony lanes rather than user-defined buckets', () => {
    expect(board).toMatch(/lane/i)
    expect(board).not.toMatch(/bucket/i)
  })
})

describe('kanban styles', () => {
  it('uses design tokens instead of literal colour values', () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(styles).toContain('var(--color-accent)')
    expect(styles).toContain('var(--color-border)')
  })

  it('lays the six lanes out as scrollable columns', () => {
    expect(styles).toMatch(/\.kanban__lanes\s*\{[^}]*grid-auto-flow:\s*column/s)
    expect(styles).toMatch(/\.kanban__lanes\s*\{[^}]*overflow-x:\s*auto/s)
  })
})
