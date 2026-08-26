import type { BoardId, WorkItemId } from '@/domain/workplace'

/**
 * Refusals are workplace-owned and disposable. A board or item the human may
 * not open is refused when it is addressed directly — it is never merely
 * omitted from a list result, and never returned.
 */
export class BoardAccessRefused extends Error {
  readonly boardId: BoardId

  constructor(boardId: BoardId) {
    super('Kolonie Workplace: that board is not available to this human.')
    this.name = 'BoardAccessRefused'
    this.boardId = boardId
  }
}

export class WorkItemAccessRefused extends Error {
  readonly itemId: WorkItemId

  constructor(itemId: WorkItemId) {
    super('Kolonie Workplace: that work item is not available to this human.')
    this.name = 'WorkItemAccessRefused'
    this.itemId = itemId
  }
}
