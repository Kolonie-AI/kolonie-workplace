import type { Lane } from '@/domain/lanes'
import type {
  BoardId,
  HumanId,
  VisibleBoard,
  WorkItemDetail,
  WorkItemId,
  WorkItemSummary,
} from '@/domain/workplace'

/**
 * Workplace-owned, disposable port over workplace data. It is not a
 * `kolonie-platform` schema proposal. The three reads load a board; the one
 * named write moves one item to one of the six Colony lanes. There is no
 * create, update of any other field, delete or persistence method.
 */
export const PREVIEW_DATA_GATEWAY: unique symbol = Symbol('previewDataGateway')

export function isPreviewDataGateway(gateway: TaskGateway): boolean {
  return gateway[PREVIEW_DATA_GATEWAY] === true
}

export interface TaskGateway {
  readonly [PREVIEW_DATA_GATEWAY]?: true
  listVisibleBoards(humanId: HumanId): Promise<readonly VisibleBoard[]>
  getBoardItems(humanId: HumanId, boardId: BoardId): Promise<readonly WorkItemSummary[]>
  getItemDetail(humanId: HumanId, itemId: WorkItemId): Promise<WorkItemDetail>
  moveItemToLane(humanId: HumanId, itemId: WorkItemId, lane: Lane): Promise<void>
}
