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

export class FixtureTaskGateway implements TaskGateway {
  readonly [PREVIEW_DATA_GATEWAY] = true as const

  async listVisibleBoards(humanId: HumanId): Promise<readonly VisibleBoard[]> {
    const visible = visibleBoardIdsFor(humanId)

    return fixtureBoards
      .filter((board) => visible.has(board.id))
      .map((board) => ({
        ...board,
        agentName:
          fixtureAgents.find((candidate) => candidate.id === board.agentId)?.name ??
          'Unknown agent',
      }))
  }

  async getBoardItems(
    humanId: HumanId,
    boardId: BoardId,
  ): Promise<readonly WorkItemSummary[]> {
    const visible = visibleBoardIdsFor(humanId)

    if (!visible.has(boardId)) {
      throw new BoardAccessRefused(boardId)
    }

    return fixtureWorkItems
      .filter((item) => item.boardId === boardId)
      .map(({ id, boardId: itemBoardId, title, lane, owner }) => ({
        id,
        boardId: itemBoardId,
        title,
        lane,
        owner,
      }))
  }

  async getItemDetail(humanId: HumanId, itemId: WorkItemId): Promise<WorkItemDetail> {
    const visible = visibleBoardIdsFor(humanId)
    const item = fixtureWorkItems.find((candidate) => candidate.id === itemId)

    if (item === undefined || !visible.has(item.boardId)) {
      throw new WorkItemAccessRefused(itemId)
    }

    return item
  }
}

export function createFixtureTaskGateway(): TaskGateway {
  return new FixtureTaskGateway()
}
