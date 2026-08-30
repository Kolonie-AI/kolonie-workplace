import type { Lane } from '@/domain/lanes'
import type {
  AttachmentId,
  BoardId,
  CardLink,
  CardLinkId,
  ChecklistItemId,
  CommentId,
  CreateAttachmentInput,
  CreateCardLinkInput,
  CreateCommentInput,
  CreateWorkItemInput,
  HumanId,
  ReorderWorkItemInput,
  UpdateChecklistItemInput,
  UpdateWorkItemInput,
  VisibleBoard,
  WorkItemDetail,
  WorkItemId,
  WorkItemMoveInput,
  WorkItemSummary,
} from '@/domain/workplace'

/**
 * Workplace-owned, disposable port over workplace data. It is not a
 * `kolonie-platform` schema proposal. Reads load a board; writes create,
 * update, reorder and delete a work item together with its comments,
 * attachments and checklist. Nothing is persisted beyond this instance.
 */
export const PREVIEW_DATA_GATEWAY: unique symbol = Symbol('previewDataGateway')

export function isPreviewDataGateway(gateway: TaskGateway): boolean {
  return gateway[PREVIEW_DATA_GATEWAY] === true
}

export interface TaskGateway {
  readonly [PREVIEW_DATA_GATEWAY]?: true
  listVisibleBoards(humanId: HumanId): Promise<readonly VisibleBoard[]>
  createBoard?(humanId: HumanId, title: string): Promise<VisibleBoard>
  renameBoard?(humanId: HumanId, boardId: BoardId, title: string): Promise<VisibleBoard>
  archiveBoard?(humanId: HumanId, boardId: BoardId): Promise<void>
  getBoardItems(humanId: HumanId, boardId: BoardId): Promise<readonly WorkItemSummary[]>
  getItemDetail(humanId: HumanId, itemId: WorkItemId): Promise<WorkItemDetail>
  moveItemToLane(
    humanId: HumanId,
    itemId: WorkItemId,
    lane: Lane | WorkItemMoveInput,
    position?: number,
    lifecycle?: Omit<WorkItemMoveInput, 'lane' | 'position'>,
  ): Promise<WorkItemDetail | void>
  createWorkItem(humanId: HumanId, input: CreateWorkItemInput): Promise<WorkItemDetail>
  updateWorkItem(
    humanId: HumanId,
    itemId: WorkItemId,
    input: UpdateWorkItemInput,
  ): Promise<WorkItemDetail>
  deleteWorkItem(humanId: HumanId, itemId: WorkItemId): Promise<void>
  reorderWorkItem(
    humanId: HumanId,
    itemId: WorkItemId,
    input: ReorderWorkItemInput,
  ): Promise<WorkItemDetail>
  createComment(
    humanId: HumanId,
    itemId: WorkItemId,
    input: CreateCommentInput,
  ): Promise<WorkItemDetail>
  updateComment(
    humanId: HumanId,
    itemId: WorkItemId,
    commentId: CommentId,
    body: string,
  ): Promise<WorkItemDetail>
  deleteComment(
    humanId: HumanId,
    itemId: WorkItemId,
    commentId: CommentId,
  ): Promise<WorkItemDetail>
  addAttachment(
    humanId: HumanId,
    itemId: WorkItemId,
    input: CreateAttachmentInput,
  ): Promise<WorkItemDetail>
  deleteAttachment(
    humanId: HumanId,
    itemId: WorkItemId,
    attachmentId: AttachmentId,
  ): Promise<WorkItemDetail>
  createChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    title: string,
  ): Promise<WorkItemDetail>
  updateChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    checklistItemId: ChecklistItemId,
    input: UpdateChecklistItemInput,
  ): Promise<WorkItemDetail>
  reorderChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    checklistItemId: ChecklistItemId,
    position: number,
  ): Promise<WorkItemDetail>
  deleteChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    checklistItemId: ChecklistItemId,
  ): Promise<WorkItemDetail>
  listCardLinks(humanId: HumanId, itemId: WorkItemId): Promise<readonly CardLink[]>
  addCardLink(
    humanId: HumanId,
    itemId: WorkItemId,
    input: CreateCardLinkInput,
  ): Promise<CardLink>
  removeCardLink(humanId: HumanId, linkId: CardLinkId): Promise<void>
}
