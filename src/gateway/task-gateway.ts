import type {
  Board,
  BoardId,
  HumanId,
  WorkItemDetail,
  WorkItemId,
  WorkItemSummary,
} from '@/domain/workplace'

/**
 * Read-only port over workplace data. It is workplace-owned and disposable: it
 * is not a `kolonie-platform` schema proposal, and it deliberately exposes no
 * create, update, delete or persistence method.
 */
export interface TaskGateway {
  listVisibleBoards(humanId: HumanId): Promise<readonly Board[]>
  getBoardItems(humanId: HumanId, boardId: BoardId): Promise<readonly WorkItemSummary[]>
  getItemDetail(humanId: HumanId, itemId: WorkItemId): Promise<WorkItemDetail>
}
