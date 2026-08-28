import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

/**
 * The comments still explain that lanes are not user-defined buckets. The
 * rules below are about what the components do, so they read the code with
 * the comments taken out.
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

describe('kanban source — lane moves without a drag library', () => {
  it('depends on no drag-and-drop library', () => {
    const declared = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    })

    for (const library of DRAG_LIBRARIES) {
      expect(declared).not.toContain(library)
    }
  })

  it('judges due dates from the clock that is handed in, never from a Date it constructs', () => {
    expect(card).toMatch(/relativeDueDate/)
    expect(card).not.toMatch(/new Date\s*\(/)
    expect(board).not.toMatch(/new Date\s*\(/)
  })

  it('moves a card with the browser drag events and a labelled lane control', () => {
    expect(card).toMatch(/draggable="true"/)
    expect(board).toMatch(/@drop/)
    expect(card).toMatch(/Move to lane/)
    expect(board).not.toMatch(/v-model/)
    expect(card).not.toMatch(/v-model/)
    expect(board).not.toMatch(/contenteditable/i)
    expect(card).not.toMatch(/contenteditable/i)
  })

  it('emits lane moves and card creation, but never delete or reorder', () => {
    expect(board).toMatch(/emit\(\s*['"]move/i)
    expect(board).toMatch(/emit\(\s*['"]create/i)

    for (const source of [board, card]) {
      expect(source).not.toMatch(/emit\(\s*['"](update|reorder|delete|save)/i)
    }
  })
})

describe('kanban source — original Colony code', () => {
  it('names no third-party task model, file, class or asset', () => {
    for (const source of [board, card, styles]) {
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
