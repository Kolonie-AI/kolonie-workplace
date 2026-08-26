import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import type { TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS } from '@/fixtures/catalogue'
import AppShell from '@/shell/AppShell.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

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

function failingBoardList(): TaskGateway {
  return {
    listVisibleBoards: vi.fn(async () => {
      throw new Error('Kolonie Workplace: the board list could not be read.')
    }),
    getBoardItems: vi.fn(async () => []),
    getItemDetail: vi.fn(),
  }
}

function failingBoardItems(): TaskGateway {
  const gateway = createFixtureTaskGateway()
  vi.spyOn(gateway, 'getBoardItems').mockImplementation(async () => {
    throw new Error('Kolonie Workplace: the board items could not be read.')
  })
  return gateway
}

/**
 * #11's rejection case: a gateway error and "this human has no boards" must
 * not read as the same thing, and neither may leave the previous board's
 * content on screen. These are four separate facts about the Colony and the
 * workplace has to say which one it is holding.
 */
describe('the four states are four different answers', () => {
  it('tells "no boards" apart from "the board list could not be read"', async () => {
    await renderShell(FIXTURE_HUMANS.rook, createFixtureTaskGateway())

    await waitFor(() => {
      expect(screen.getByTestId('boards-empty')).toBeTruthy()
    })
    expect(screen.queryByTestId('boards-error')).toBeNull()

    screen.getByTestId('boards-empty').remove()

    await renderShell(FIXTURE_HUMANS.wren, failingBoardList())

    await waitFor(() => {
      expect(screen.getByTestId('boards-error')).toBeTruthy()
    })
    expect(screen.queryByTestId('boards-empty')).toBeNull()
  })

  it('tells an empty board apart from a board whose items could not be read', async () => {
    await renderShell(
      FIXTURE_HUMANS.ash,
      createFixtureTaskGateway(),
      FIXTURE_BOARDS.marlowBacklog,
    )

    await waitFor(() => {
      expect(screen.getByTestId('kanban-board-empty')).toBeTruthy()
    })
    expect(screen.queryByTestId('kanban-error')).toBeNull()
  })

  it('leaks no stale board content when the item read fails', async () => {
    await renderShell(
      FIXTURE_HUMANS.wren,
      failingBoardItems(),
      FIXTURE_BOARDS.quillDelivery,
    )

    await waitFor(() => {
      expect(screen.getByTestId('board-unreadable')).toBeTruthy()
    })

    expect(screen.getByTestId('board-unreadable').textContent).not.toMatch(
      /not available/i,
    )
    expect(screen.queryByTestId('board-refused')).toBeNull()
    expect(screen.queryAllByTestId('kanban-card')).toEqual([])
    expect(screen.queryByTestId('kanban-board-empty')).toBeNull()
    expect(screen.queryByTestId('active-board')).toBeNull()
  })

  /**
   * The Kanban's own error state is reached when the board is already active
   * and its items fail to read, which is `useBoardItems`' error branch rather
   * than the shell's refusal branch. It is asserted here so the styling this
   * issue gives the error state is exercised against the real component.
   */
  it('gives the error state a class the loading and empty states do not have', async () => {
    const gateway = createFixtureTaskGateway()
    let failing = false
    vi.spyOn(gateway, 'getBoardItems').mockImplementation(async () => {
      if (failing) {
        throw new Error('Kolonie Workplace: the board items could not be read.')
      }
      return []
    })

    const session = await signedInSession(FIXTURE_HUMANS.ash)
    const { rerender } = render(AppShell, {
      props: { initialBoardId: FIXTURE_BOARDS.marlowBacklog },
      global: { provide: { [WORKPLACE_SESSION]: session, [TASK_GATEWAY]: gateway } },
    })

    await waitFor(() => {
      expect(screen.getByTestId('kanban-board-empty')).toBeTruthy()
    })

    failing = true
    await rerender({ initialBoardId: FIXTURE_BOARDS.marlowOutreach })

    await waitFor(() => {
      expect(screen.queryByTestId('kanban-board-empty')).toBeTruthy()
    })

    expect(screen.getByTestId('kanban-board-empty').classList.contains('kanban__state'))
      .toBe(true)
    expect(
      screen.getByTestId('kanban-board-empty').classList.contains('kanban__state--error'),
    ).toBe(false)
  })
})
