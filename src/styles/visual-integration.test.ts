import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

const STYLESHEETS = [
  'src/styles/tokens.css',
  'src/shell/app-shell.css',
  'src/boards/board-list.css',
  'src/kanban/kanban-board.css',
  'src/list/list-view.css',
  'src/detail/detail-pane.css',
  'src/session/session.css',
] as const

const sheets = Object.fromEntries(
  STYLESHEETS.map((path) => [path, readFileSync(resolve(root, path), 'utf8')]),
) as Record<(typeof STYLESHEETS)[number], string>

const everythingButTokens = STYLESHEETS.filter(
  (path) => path !== 'src/styles/tokens.css',
).map((path) => sheets[path])

describe('visual integration — one token system, not five demos', () => {
  it('keeps every literal colour in the token file', () => {
    for (const sheet of everythingButTokens) {
      expect(sheet).not.toMatch(/#[0-9a-fA-F]{3,8}/)
      expect(sheet).not.toMatch(/\brgba?\(/)
      expect(sheet).not.toMatch(/\bhsla?\(/)
    }
  })

  it('spaces and rounds from the shared scales rather than ad-hoc lengths', () => {
    for (const sheet of everythingButTokens) {
      expect(sheet).not.toMatch(/border-radius:\s*\d/)
    }
  })
})

describe('visual integration — a visible keyboard focus state on every control', () => {
  const INTERACTIVE = [
    ['src/boards/board-list.css', '.board-list__board'],
    ['src/kanban/kanban-board.css', '.kanban-card'],
    ['src/list/list-view.css', '.list-row'],
    ['src/detail/detail-pane.css', '.detail-pane__close'],
    ['src/detail/detail-pane.css', '.detail-pane__reference'],
    ['src/detail/detail-pane.css', '.detail-overlay'],
    ['src/detail/detail-pane.css', '.detail-pane__lane-control'],
    ['src/detail/detail-pane.css', '.detail-pane__edit'],
    ['src/detail/detail-pane.css', '.detail-pane__rail-button'],
    ['src/detail/detail-pane.css', '.detail-checklist__tick'],
    ['src/detail/detail-pane.css', '.detail-checklist__title'],
    ['src/detail/detail-pane.css', '.detail-checklist__move'],
    ['src/detail/detail-pane.css', '.detail-checklist__remove'],
    ['src/detail/detail-pane.css', '.detail-checklist__delete'],
    ['src/detail/detail-pane.css', '.detail-checklist__cancel'],
    ['src/detail/detail-pane.css', '.detail-checklist__submit'],
    ['src/detail/detail-pane.css', '.detail-activity__composer'],
    ['src/detail/detail-pane.css', '.detail-activity__submit'],
    ['src/detail/detail-pane.css', '.detail-activity__cancel'],
    ['src/detail/detail-pane.css', '.detail-activity__edit'],
    ['src/detail/detail-pane.css', '.detail-activity__delete'],
    ['src/shell/app-shell.css', '.app-shell__tab'],
    ['src/shell/app-shell.css', '.app-shell__sidebar-toggle'],
    ['src/shell/app-shell.css', '.app-shell__menu-button'],
    ['src/shell/app-shell.css', '.app-shell__search-button'],
    ['src/kanban/kanban-board.css', '.lane-composer__add'],
    ['src/kanban/kanban-board.css', '.lane-composer__submit'],
    ['src/kanban/kanban-board.css', '.lane-composer__cancel'],
    ['src/kanban/kanban-board.css', '.lane-composer__input'],
    ['src/session/session.css', '.session-signed-out__candidate'],
    ['src/session/session.css', '.session-human__sign-out'],
  ] as const

  it.each(INTERACTIVE)('%s gives %s a focus-visible outline', (path, selector) => {
    const sheet = sheets[path]
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rule = new RegExp(`${escaped}:focus-visible\\s*\\{[^}]*outline:`, 's')

    expect(sheet).toMatch(rule)
  })

  it('never removes an outline without putting one back', () => {
    for (const sheet of everythingButTokens) {
      expect(sheet).not.toMatch(/outline:\s*(none|0)\s*;/)
    }
  })
})

describe('visual integration — blocked is urgent without being a second accent', () => {
  it('gives blocked its own token rather than reusing the accent', () => {
    expect(sheets['src/styles/tokens.css']).toContain('--color-blocked:')
    expect(sheets['src/styles/tokens.css']).toContain('--color-blocked-soft:')
  })

  it('marks a blocked card and a blocked row with that token', () => {
    expect(sheets['src/kanban/kanban-board.css']).toMatch(
      /\.kanban-card\[data-blocked="true"\]\s*\{[^}]*var\(--color-blocked\)/s,
    )
    expect(sheets['src/list/list-view.css']).toMatch(
      /\.list-row\[data-blocked="true"\]\s*\{[^}]*var\(--color-blocked\)/s,
    )
  })

  it('keeps the blocked marker an edge and a flag, not a filled card', () => {
    expect(sheets['src/kanban/kanban-board.css']).not.toMatch(
      /\.kanban-card\[data-blocked="true"\]\s*\{[^}]*background:\s*var\(--color-blocked\)\s*;/s,
    )
  })
})

describe('visual integration — loading, empty and error are visibly distinct', () => {
  it('gives the error state a treatment neither loading nor empty has', () => {
    for (const path of [
      'src/kanban/kanban-board.css',
      'src/list/list-view.css',
    ] as const) {
      expect(sheets[path]).toMatch(/--error\s*\{[^}]*border-inline-start:/s)
      expect(sheets[path]).toMatch(/--error\s*\{[^}]*var\(--color-blocked\)/s)
    }
  })

  it('marks the loading state as its own state rather than a bare paragraph', () => {
    for (const path of [
      'src/kanban/kanban-board.css',
      'src/list/list-view.css',
    ] as const) {
      expect(sheets[path]).toMatch(/--loading\s*\{/)
    }
  })
})

describe('visual integration — a failed board read does not look like a refusal', () => {
  const shell = sheets['src/shell/app-shell.css']

  it('gives the read failure the same blocked-coloured edge as other read errors', () => {
    expect(shell).toMatch(
      /\.app-shell__read-error\s*\{[^}]*border-inline-start:[^;]*var\(--color-blocked\)/s,
    )
    expect(shell).toMatch(
      /\.app-shell__read-error\s*\{[^}]*background:\s*var\(--color-blocked-soft\)/s,
    )
  })

  it('keeps the permission refusal quiet and visually distinct', () => {
    expect(shell).not.toMatch(
      /\.app-shell__refusal\s*\{[^}]*border-inline-start:/s,
    )
    expect(shell).not.toMatch(
      /\.app-shell__refusal\s*\{[^}]*var\(--color-blocked-soft\)/s,
    )
  })
})

describe('visual integration — Trello board canvas, not a white card on a grey page', () => {
  it('paints the board canvas from the canvas token rather than the card surface', () => {
    expect(sheets['src/shell/app-shell.css']).toMatch(
      /\.app-shell__canvas\s*\{[^}]*background:\s*var\(--color-canvas\)/s,
    )
  })

  it('keeps list-view styles on the shared tokens and does not restyle them as Trello lists', () => {
    expect(sheets['src/list/list-view.css']).not.toMatch(/--color-list-well/)
    expect(sheets['src/list/list-view.css']).not.toMatch(/--lane-width/)
  })
})

describe('visual integration — the page does not overflow, only the board canvas', () => {
  it('scrolls the lanes horizontally and clips nothing above them', () => {
    expect(sheets['src/kanban/kanban-board.css']).toMatch(
      /\.kanban__lanes\s*\{[^}]*overflow-x:\s*auto/s,
    )
    expect(sheets['src/shell/app-shell.css']).toMatch(
      /\.app-shell\s*\{[^}]*overflow-x:\s*hidden/s,
    )
  })

  it('keeps every shell region able to shrink below its content width', () => {
    const shell = sheets['src/shell/app-shell.css']

    for (const region of [
      '.app-shell__workspace',
      '.app-shell__main',
      '.app-shell__canvas',
      '.app-shell__board-area',
    ]) {
      const escaped = region.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(shell).toMatch(new RegExp(`${escaped}\\s*\\{[^}]*min-inline-size:\\s*0`, 's'))
    }
  })
})

describe('visual integration — the narrow viewport keeps the whole journey reachable', () => {
  const shell = sheets['src/shell/app-shell.css']

  it('never hides the board navigation, which the journey needs to select a board', () => {
    expect(shell).not.toMatch(/\.app-shell__sidebar\s*\{[^}]*display:\s*none/s)
  })

  it('stacks the sidebar above the workspace rather than beside it', () => {
    expect(shell).toMatch(/@media\s*\(max-width:\s*48rem\)/)
    expect(shell).toMatch(
      /\.app-shell,\s*\n\s*\.app-shell\[data-sidebar-collapsed="true"\]\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    )
  })

  it('stacks the detail pane under the board so neither is clipped', () => {
    expect(shell).toMatch(
      /\.app-shell__board-area\[data-detail-open="true"\]\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    )
  })

  /**
   * The card back is a fixed overlay, not a stacked column. Close sits in the
   * dialog header, so the fold that used to hide it cannot hide it now.
   */
  it('opens the card back as a fixed overlay rather than a stacked column', () => {
    const pane = sheets['src/detail/detail-pane.css']
    expect(pane).toMatch(/\.detail-layer\s*\{[^}]*position:\s*fixed/s)
    expect(pane).toMatch(/\.detail-overlay\s*\{[^}]*position:\s*absolute/s)
  })
})

describe('visual integration — the preview-data indication is chrome, not a banner', () => {
  const shell = sheets['src/shell/app-shell.css']

  it('draws from the accent tokens rather than a warning colour of its own', () => {
    expect(shell).toMatch(
      /\.app-shell__preview-data\s*\{[^}]*var\(--color-accent-soft\)/s,
    )
    expect(shell).not.toMatch(
      /\.app-shell__preview-data\s*\{[^}]*var\(--color-blocked\)/s,
    )
  })

  it('stays inside the board bar rather than adding a strip of its own', () => {
    expect(shell).not.toMatch(
      /\.app-shell__preview-data\s*\{[^}]*(position:\s*(fixed|sticky|absolute)|inline-size:\s*100%|display:\s*block)/s,
    )
  })
})

describe('visual integration — a calm board product, not a dashboard', () => {
  it('uses no gradient, glass blur or oversized radius anywhere', () => {
    for (const sheet of Object.values(sheets)) {
      expect(sheet).not.toMatch(/gradient\(/i)
      expect(sheet).not.toMatch(/backdrop-filter/i)
      expect(sheet).not.toMatch(/border-radius:\s*var\(--radius-large\)\s*;[^}]*font-size:\s*3/s)
    }
  })

  it('names no third-party class, asset or module in any stylesheet', () => {
    for (const sheet of Object.values(sheets)) {
      const withoutComments = sheet
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')

      expect(withoutComments).not.toMatch(/\bis-(loading|active|done)\b/)
      expect(withoutComments).not.toMatch(/\bbucket\b/i)
    }
  })
})
