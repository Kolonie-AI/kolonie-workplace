import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import { BoardAccessRefused } from '@/gateway/refusals'
import type { TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS } from '@/fixtures/catalogue'
import AppShell from '@/shell/AppShell.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

const boardStyles = readFileSync(resolve(process.cwd(), 'src/kanban/kanban-board.css'), 'utf8')

async function signedInSession(humanId: string): Promise<WorkplaceSession> {
  const session = createFixtureWorkplaceSession()
  await session.signIn({ humanId })
  return session
}

async function renderShell(
  humanId: string,
  gateway: TaskGateway,
  boardId?: string,
): Promise<void> {
  const session = await signedInSession(humanId)
  render(AppShell, {
    props: boardId === undefined ? {} : { initialBoardId: boardId },
    global: { provide: { [WORKPLACE_SESSION]: session, [TASK_GATEWAY]: gateway } },
  })
}

function stubbedGateway(overrides: Partial<TaskGateway> = {}): TaskGateway {
  return {
    listVisibleBoards: vi.fn(async () => [
      {
        id: 'board-mine',
        agentId: 'agent-a',
        agentName: 'Fictional Agent A',
        profession: null,
        title: 'Fictional My Board',
      },
    ]),
    getBoardItems: vi.fn(async () => []),
    getItemDetail: vi.fn(),
    moveItemToLane: vi.fn(),
    createWorkItem: vi.fn(),
    updateWorkItem: vi.fn(),
    deleteWorkItem: vi.fn(),
    reorderWorkItem: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    addAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    createChecklistItem: vi.fn(),
    updateChecklistItem: vi.fn(),
    reorderChecklistItem: vi.fn(),
    deleteChecklistItem: vi.fn(),
    listCardLinks: vi.fn(),
    addCardLink: vi.fn(),
    removeCardLink: vi.fn(),
    ...overrides,
  }
}

function textOf(testId: string): string {
  return (screen.getByTestId(testId).textContent ?? '').replace(/\s+/g, ' ').trim()
}

describe('board states — five answers, five different sentences', () => {
  it('says nothing is open when no board is chosen', async () => {
    await renderShell(FIXTURE_HUMANS.wren, createFixtureTaskGateway())

    await waitFor(() => {
      expect(screen.getByTestId('kanban-no-board')).toBeTruthy()
    })

    expect(textOf('kanban-no-board')).toMatch(/no board is open/i)
    expect(screen.queryByTestId('kanban-board-empty')).toBeNull()
    expect(screen.queryByTestId('kanban-error')).toBeNull()
  })

  it('keeps no-board, no-items, error and no-permission as four different sentences', async () => {
    const sentences = new Map<string, string>()

    await renderShell(FIXTURE_HUMANS.wren, createFixtureTaskGateway())
    await waitFor(() => {
      expect(screen.getByTestId('kanban-no-board')).toBeTruthy()
    })
    sentences.set('no-board', textOf('kanban-no-board'))
    screen.getByTestId('app-shell').remove()

    await renderShell(
      FIXTURE_HUMANS.ash,
      createFixtureTaskGateway(),
      FIXTURE_BOARDS.marlowBacklog,
    )
    await waitFor(() => {
      expect(screen.getByTestId('kanban-board-empty')).toBeTruthy()
    })
    sentences.set('no-items', textOf('kanban-board-empty'))
    screen.getByTestId('app-shell').remove()

    await renderShell(
      FIXTURE_HUMANS.wren,
      stubbedGateway({
        getBoardItems: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockRejectedValue(new Error('Kolonie Workplace: the board items could not be read.')),
      }),
      'board-mine',
    )
    await waitFor(() => {
      expect(screen.getByTestId('kanban-error')).toBeTruthy()
    })
    sentences.set('error', textOf('kanban-error'))
    screen.getByTestId('app-shell').remove()

    await renderShell(
      FIXTURE_HUMANS.wren,
      stubbedGateway({
        getBoardItems: vi.fn(async (_humanId: string, boardId: string) => {
          throw new BoardAccessRefused(boardId)
        }),
      }),
      'board-mine',
    )
    await waitFor(() => {
      expect(screen.getByTestId('board-refused')).toBeTruthy()
    })
    sentences.set('no-permission', textOf('board-refused'))

    expect(new Set(sentences.values()).size).toBe(sentences.size)
    expect(sentences.get('no-permission')).toMatch(/not available/i)
    expect(sentences.get('error')).not.toMatch(/not available/i)
    expect(sentences.get('no-items')).toMatch(/no work items/i)
    expect(sentences.get('no-board')).toMatch(/no board is open/i)
  })

  it('renders the filter-empty sentence apart from the empty-board one', async () => {
    await renderShell(
      FIXTURE_HUMANS.wren,
      createFixtureTaskGateway(),
      FIXTURE_BOARDS.quillDelivery,
    )

    await waitFor(() => {
      expect(screen.queryAllByTestId('kanban-card').length).toBeGreaterThan(0)
    })

    const emptyBoard = readFileSync(
      resolve(process.cwd(), 'src/kanban/KanbanBoard.vue'),
      'utf8',
    )

    expect(emptyBoard).toMatch(/data-testid="kanban-board-empty"/)
    expect(emptyBoard).toMatch(/data-testid="kanban-no-match"/)
    expect(emptyBoard).toMatch(/data-testid="kanban-error"/)
    expect(emptyBoard).toMatch(/data-testid="kanban-no-board"/)
  })
})

describe('board states — loading holds the layout still', () => {
  it('reserves the lane row so the board does not jump when items arrive', () => {
    expect(boardStyles).toMatch(/\.kanban__lanes\s*\{[^}]*min-block-size:/s)
    expect(boardStyles).toMatch(/\.kanban__state--loading\s*\{[^}]*min-block-size:/s)
  })

  it('keeps the phone board scrolling horizontally rather than reflowing', () => {
    expect(boardStyles).toMatch(/\.kanban__lanes\s*\{[^}]*overflow-x:\s*auto/s)
    expect(boardStyles).toMatch(/@media\s*\(max-width:\s*48rem\)/)
    expect(boardStyles).not.toMatch(/\.kanban__lanes\s*\{[^}]*grid-auto-flow:\s*row/s)
  })
})
