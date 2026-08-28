import type { Lane } from '@/domain/lanes'
import type {
  BoardId,
  HumanId,
  VisibleBoard,
  WorkItemDetail,
  WorkItemId,
  WorkItemSummary,
} from '@/domain/workplace'
import {
  fixtureAgents,
  fixtureBoards,
  fixtureHumans,
  fixtureWorkItems,
} from '@/fixtures/catalogue'
import { BoardAccessRefused, WorkItemAccessRefused } from '@/gateway/refusals'
import { PREVIEW_DATA_GATEWAY, type TaskGateway } from '@/gateway/task-gateway'

function visibleBoardIdsFor(humanId: HumanId): ReadonlySet<BoardId> {
  const human = fixtureHumans.find((candidate) => candidate.id === humanId)

  if (human === undefined) {
    return new Set()
  }

  return new Set(
    fixtureAgents
      .filter((agent) => human.agentIds.includes(agent.id))
      .flatMap((agent) => agent.boardIds),
  )
}

function toSummary(item: WorkItemDetail): WorkItemSummary {
  return {
    id: item.id,
    boardId: item.boardId,
    title: item.title,
    lane: item.lane,
    owner: item.owner,
  }
}

/**
 * In-memory copy of the fixture catalogue. A lane move lives here for the
 * lifetime of this instance and is never written to the catalogue, a server,
 * or browser storage.
 */
export class FixtureTaskGateway implements TaskGateway {
  readonly [PREVIEW_DATA_GATEWAY] = true as const
  private items: WorkItemDetail[] = fixtureWorkItems.map((item) => ({ ...item }))

  async listVisibleBoards(humanId: HumanId): Promise<readonly VisibleBoard[]> {
    const visible = visibleBoardIdsFor(humanId)

    return fixtureBoards
      .filter((board) => visible.has(board.id))
      .map((board) => {
        const agent = fixtureAgents.find((candidate) => candidate.id === board.agentId)

        return {
          ...board,
          agentName: agent?.name ?? 'Unknown agent',
          profession: agent?.profession ?? null,
        }
      })
  }

  async getBoardItems(
    humanId: HumanId,
    boardId: BoardId,
  ): Promise<readonly WorkItemSummary[]> {
    const visible = visibleBoardIdsFor(humanId)

    if (!visible.has(boardId)) {
      throw new BoardAccessRefused(boardId)
    }

    return this.items.filter((item) => item.boardId === boardId).map(toSummary)
  }

  async getItemDetail(humanId: HumanId, itemId: WorkItemId): Promise<WorkItemDetail> {
    const visible = visibleBoardIdsFor(humanId)
    const item = this.items.find((candidate) => candidate.id === itemId)

    if (item === undefined || !visible.has(item.boardId)) {
      throw new WorkItemAccessRefused(itemId)
    }

    return item
  }

  async moveItemToLane(humanId: HumanId, itemId: WorkItemId, lane: Lane): Promise<void> {
    const visible = visibleBoardIdsFor(humanId)
    const item = this.items.find((candidate) => candidate.id === itemId)

    if (item === undefined || !visible.has(item.boardId)) {
      throw new WorkItemAccessRefused(itemId)
    }

    this.items = this.items.map((candidate) =>
      candidate.id === itemId ? { ...candidate, lane } : candidate,
    )
  }
}

export function createFixtureTaskGateway(): TaskGateway {
  return new FixtureTaskGateway()
}
