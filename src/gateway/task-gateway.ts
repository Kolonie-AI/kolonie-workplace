import type {
  BoardId,
  HumanId,
  VisibleBoard,
  WorkItemDetail,
  WorkItemId,
  WorkItemSummary,
} from '@/domain/workplace'

/**
 * Read-only port over workplace data. It is workplace-owned and disposable: it
 * is not a `kolonie-platform` schema proposal, and it deliberately exposes no
 * create, update, delete or persistence method.
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
}
