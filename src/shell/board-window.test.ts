import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import {
  FIXTURE_BOARDS,
  FIXTURE_HUMANS,
  fixtureAgents,
  fixtureBoards,
} from '@/fixtures/catalogue'
import AppShell from '@/shell/AppShell.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION } from '@/session/workplace-session'

const root = process.cwd()
const shell = readFileSync(resolve(root, 'src/shell/app-shell.css'), 'utf8')
const kanban = readFileSync(resolve(root, 'src/kanban/kanban-board.css'), 'utf8')
const tokens = readFileSync(resolve(root, 'src/styles/tokens.css'), 'utf8')
const boardList = readFileSync(resolve(root, 'src/boards/BoardList.vue'), 'utf8')
const boardListCss = readFileSync(resolve(root, 'src/boards/board-list.css'), 'utf8')
const appShell = readFileSync(resolve(root, 'src/shell/AppShell.vue'), 'utf8')

const quill = fixtureAgents.find((agent) => agent.id === 'fictional-agent-quill')
const quillBoard = fixtureBoards.find((board) => board.id === FIXTURE_BOARDS.quillDelivery)

async function renderOpenBoard() {
  const session = createFixtureWorkplaceSession()
  await session.signIn({ humanId: FIXTURE_HUMANS.wren })
  const view = render(AppShell, {
    props: { initialBoardId: FIXTURE_BOARDS.quillDelivery },
    global: {
      provide: {
        [WORKPLACE_SESSION]: session,
        [TASK_GATEWAY]: createFixtureTaskGateway(),
      },
    },
  })

  await waitFor(() => {
    expect(screen.getAllByTestId('kanban-lane')).toHaveLength(6)
  })

  return view
}

describe('board window — one bar, not three stacked headers', () => {
  it('does not keep a separate top bar, board header and active-board card', () => {
    expect(shell).not.toMatch(/\.app-shell__topbar\s*\{/)
    expect(shell).not.toMatch(/\.app-shell__active-board\s*\{/)
    expect(appShell).not.toMatch(/Work board/)
    expect(appShell).not.toMatch(/app-shell__active-board-profession/)
  })

  it('lays the workspace as one compact bar over a filling canvas', () => {
    expect(shell).toMatch(
      /\.app-shell__workspace\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/s,
    )
    expect(shell).not.toMatch(
      /\.app-shell__workspace\s*\{[^}]*grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)/s,
    )
  })

  it('clips the page so the wells, not the document, take overflow', () => {
    expect(shell).toMatch(/\.app-shell\s*\{[^}]*overflow:\s*hidden/s)
    expect(shell).toMatch(/\.app-shell__main\s*\{[^}]*overflow:\s*hidden/s)
  })
})

describe('board window — list wells fill the remaining viewport', () => {
  it('stretches the six wells to the canvas, not to the height of their cards', () => {
    expect(kanban).toMatch(/\.kanban__lanes\s*\{[^}]*align-items:\s*stretch/s)
    expect(kanban).not.toMatch(/\.kanban__lanes\s*\{[^}]*align-items:\s*start/s)
    expect(kanban).toMatch(/\.kanban__lane\s*\{[^}]*minmax\(0,\s*1fr\)/s)
    expect(kanban).toMatch(/\.kanban__cards\s*\{[^}]*overflow-y:\s*auto/s)
  })

  it('rejects content-sized wells that overflow the page', () => {
    expect(kanban).not.toMatch(/\.kanban__cards\s*\{[^}]*overflow:\s*visible/s)
    expect(kanban).not.toMatch(/\.kanban__lanes\s*\{[^}]*overflow:\s*visible/s)
  })

  it('keeps Add a card as the last child of each well so it stays on screen', async () => {
    await renderOpenBoard()

    for (const lane of screen.getAllByTestId('kanban-lane')) {
      const last = lane.lastElementChild
      expect(last?.classList.contains('lane-composer')).toBe(true)
      expect(within(lane as HTMLElement).getByRole('button', { name: /Add a card/ })).toBeTruthy()
    }
  })

  it('keeps horizontal overflow of the sixth lane', () => {
    expect(kanban).toMatch(/\.kanban__lanes\s*\{[^}]*overflow-x:\s*auto/s)
    expect(kanban).toMatch(/\.kanban__lanes\s*\{[^}]*grid-auto-columns:\s*var\(--lane-width\)/s)
  })

  it('keeps --lane-width in the Trello-like 272–284px band', () => {
    const match = tokens.match(/--lane-width:\s*([0-9.]+)rem/)
    expect(match?.[1]).toBeDefined()
    const px = Number(match?.[1]) * 16
    expect(px).toBeGreaterThanOrEqual(272)
    expect(px).toBeLessThanOrEqual(284)
  })
})

describe('board window — chrome copy', () => {
  it('renders the board title once in the board bar, not again above the lanes', async () => {
    if (quillBoard === undefined) {
      throw new Error('Kolonie Workplace: missing Quill Delivery fixture.')
    }

    await renderOpenBoard()

    const titleHits = screen.getAllByText(quillBoard.title)
    expect(titleHits).toHaveLength(2)
    expect(screen.getByTestId('sidebar').textContent).toContain(quillBoard.title)
    expect(screen.getByTestId('active-board').textContent?.trim()).toBe(quillBoard.title)
    expect(screen.getByTestId('board-header').contains(screen.getByTestId('active-board'))).toBe(
      true,
    )
    expect(screen.queryByRole('heading', { name: 'Work board' })).toBeNull()
    expect(screen.queryByTestId('topbar')).toBeNull()
  })

  it('does not render the profession paragraph above the lanes', async () => {
    if (quill === undefined || quill.profession === null) {
      throw new Error('Kolonie Workplace: Quill fixture must declare a profession.')
    }

    await renderOpenBoard()

    const main = screen.getByRole('main')
    expect(main.textContent).not.toContain(quill.profession)
    expect(screen.getByTestId('board-header').textContent).not.toContain(quill.profession)
    expect(screen.queryByText('Profession not declared')).toBeNull()
  })

  it('does not put the profession paragraph in the sidebar board list', async () => {
    if (quill === undefined || quill.profession === null) {
      throw new Error('Kolonie Workplace: Quill fixture must declare a profession.')
    }

    await renderOpenBoard()

    expect(screen.getByTestId('sidebar').textContent).not.toContain(quill.profession)
    expect(boardList).not.toMatch(/board-list__profession/)
    expect(boardListCss).not.toMatch(/board-list__profession/)
  })

  it('keeps agent grouping as a small label in the switcher', async () => {
    await renderOpenBoard()

    const group = screen.getAllByTestId('board-group')[0]
    expect(group?.textContent).toContain('Fictional Agent Quill')
  })

  it('names the sidebar collapse control without a labelled body-copy button', async () => {
    await renderOpenBoard()

    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(collapse.textContent?.trim()).toBe('')
    expect(collapse.getAttribute('aria-label')).toBe('Collapse sidebar')

    await fireEvent.click(collapse)
    expect(screen.getByRole('button', { name: 'Expand sidebar' }).textContent?.trim()).toBe('')
  })

  it('marks example data as a quiet chip, not a sentence', async () => {
    await renderOpenBoard()

    const mark = screen.getByTestId('preview-data-indication')
    expect(mark.textContent?.trim()).toBe('Example data')
    expect(mark.textContent).not.toMatch(/session-local/)
    expect(screen.getByTestId('board-header').contains(mark)).toBe(true)
  })
})
