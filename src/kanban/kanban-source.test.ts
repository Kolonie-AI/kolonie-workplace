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
const composer = withoutComments(
  readFileSync(resolve(root, 'src/kanban/LaneComposer.vue'), 'utf8'),
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

  it('moves a card with the browser drag events and keeps no labelled lane control on the face', () => {
    expect(card).toMatch(/draggable="true"/)
    expect(board).toMatch(/@drop/)
    expect(card).not.toMatch(/Move to lane/)
    expect(card).not.toMatch(/<details\b/)
    expect(card).not.toMatch(/kanban-card-move/)
    expect(board).not.toMatch(/v-model/)
    expect(card).not.toMatch(/v-model/)
    expect(board).not.toMatch(/contenteditable/i)
    expect(card).not.toMatch(/contenteditable/i)
  })

  it('emits lane moves, within-lane reorders and card creation, but never delete', () => {
    expect(board).toMatch(/emit\(\s*['"]move/i)
    expect(board).toMatch(/emit\(\s*['"]reorder/i)
    expect(board).toMatch(/emit\(\s*['"]create/i)

    for (const source of [board, card]) {
      expect(source).not.toMatch(/emit\(\s*['"](update|delete|save)/i)
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

  it('does not grow a seventh list or a list-create control', () => {
    expect(board).not.toMatch(/add another list/i)
    expect(board).not.toMatch(/kanban-add-list/)
    expect(composer).not.toMatch(/add another list/i)
  })
})

describe('kanban source — Trello inline add-card composer', () => {
  it('opens a textarea with Add card and cancel, labelled Add a card when collapsed', () => {
    expect(composer).toMatch(/<textarea\b/)
    expect(composer).toMatch(/Add a card/)
    expect(composer).toMatch(/>\s*Add card\s*</)
    expect(composer).toMatch(/Cancel adding a card/)
    expect(composer).not.toMatch(/<input\b/)
  })
})

describe('kanban source — Trello card face covers and badges', () => {
  it('gives colour covers a strip taller than 8px and image covers a Trello-band height', () => {
    expect(styles).toMatch(/\.kanban-card__cover\s*\{[^}]*block-size:\s*var\(--space-4\)/s)
    expect(styles).not.toMatch(/\.kanban-card__cover\s*\{[^}]*block-size:\s*var\(--space-2\)/s)
    expect(styles).toMatch(
      /\.kanban-card__cover\[data-cover-kind="image"\]\s*\{[^}]*block-size:\s*calc\(\s*var\(--space-8\)\s*\*\s*2\s*\+\s*var\(--space-6\)\s*\)/s,
    )
    expect(styles).toMatch(/\.kanban-card__cover-image\s*\{[^}]*object-fit:\s*cover/s)
    expect(styles).toMatch(/\.kanban-card\s*\{[^}]*overflow:\s*hidden/s)
    expect(styles).toMatch(/\.kanban-card\s*\{[^}]*border-radius:\s*var\(--radius-medium\)/s)
  })

  it('does not put the letters Aa on the description badge', () => {
    expect(card).not.toMatch(/>Aa</)
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

  it('gives each list a fixed well width rather than stretching six equal columns', () => {
    expect(styles).toMatch(/\.kanban__lanes\s*\{[^}]*grid-auto-columns:\s*var\(--lane-width\)/s)
    expect(styles).not.toMatch(/minmax\(\s*13rem\s*,\s*1fr\s*\)/)
  })

  it('paints the list well, the board canvas and the card as three distinct tones', () => {
    expect(styles).toMatch(
      /\.kanban__lane\s*\{[^}]*background:\s*var\(--color-list-well\)/s,
    )
    expect(styles).toMatch(
      /\.kanban-card\s*\{[^}]*background:\s*var\(--color-surface\)/s,
    )
    expect(styles).not.toMatch(
      /\.kanban__lane\s*\{[^}]*background:\s*var\(--color-canvas\)/s,
    )
    expect(styles).not.toMatch(
      /\.kanban__lane\s*\{[^}]*background:\s*var\(--color-surface\)/s,
    )
  })

  it('does not keep the standing drag-instruction chrome', () => {
    expect(styles).not.toMatch(/kanban__move-hint/)
  })

  it('lifts a dragged card and inserts a drop placeholder', () => {
    expect(styles).toMatch(/\.kanban-card\[data-lifted="true"\]/)
    expect(styles).toMatch(/\.kanban__placeholder/)
    expect(board).toMatch(/kanban-drop-placeholder/)
  })

  it('disables the added drag flourish when the operator prefers reduced motion', () => {
    expect(styles).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.kanban-card\s*\{[^}]*transition:\s*none/s,
    )
    expect(styles).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.kanban-card\[data-lifted="true"\]\s*\{[^}]*transform:\s*none/s,
    )
  })
})
