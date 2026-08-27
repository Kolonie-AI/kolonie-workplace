import type { Lane } from '@/domain/lanes'
import type {
  AttachmentId,
  BoardId,
  ChecklistItem,
  ChecklistItemId,
  CommentId,
  CreateAttachmentInput,
  CreateCommentInput,
  CreateWorkItemInput,
  HumanId,
  ReorderWorkItemInput,
  UpdateChecklistItemInput,
  UpdateWorkItemInput,
  VisibleBoard,
  WorkItemAttachment,
  WorkItemComment,
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

function cloneItem(item: WorkItemDetail): WorkItemDetail {
  return {
    ...item,
    labels: item.labels.map((label) => ({ ...label })),
    assignees: item.assignees.map((assignee) => ({ ...assignee })),
    checklist: item.checklist.map((entry) => ({ ...entry })),
    comments: item.comments.map((comment) => ({ ...comment })),
    attachments: item.attachments.map((attachment) => ({ ...attachment })),
    externalReferences: item.externalReferences.map((reference) => ({ ...reference })),
    ...(item.handover === undefined
      ? {}
      : {
          handover: {
            ...item.handover,
            evidence: item.handover.evidence.map((entry) => ({ ...entry })),
          },
        }),
    ...(item.blocker === undefined ? {} : { blocker: { ...item.blocker } }),
  }
}

function toSummary(item: WorkItemDetail): WorkItemSummary {
  return {
    id: item.id,
    boardId: item.boardId,
    title: item.title,
    lane: item.lane,
    owner: item.owner,
    description: item.description,
    labels: item.labels,
    assignees: item.assignees,
    priority: item.priority,
    dueDate: item.dueDate,
    percentDone: item.percentDone,
    checklist: item.checklist,
    comments: item.comments,
    attachments: item.attachments,
    coverColour: item.coverColour,
    position: item.position,
  }
}

function nextId(prefix: string, existing: readonly string[]): string {
  let index = existing.length + 1
  let candidate = `${prefix}-${index}`
  while (existing.includes(candidate)) {
    index += 1
    candidate = `${prefix}-${index}`
  }
  return candidate
}

function reindexChecklist(items: readonly ChecklistItem[]): ChecklistItem[] {
  return items.map((item, index) => ({ ...item, position: index }))
}

/**
 * In-memory copy of the fixture catalogue. Writes live here for the lifetime
 * of this instance and are never written to the catalogue, a server, or
 * browser storage.
 */
export class FixtureTaskGateway implements TaskGateway {
  readonly [PREVIEW_DATA_GATEWAY] = true as const
  private items: WorkItemDetail[] = fixtureWorkItems.map(cloneItem)

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

    return this.items
      .filter((item) => item.boardId === boardId)
      .slice()
      .sort((left, right) => left.position - right.position)
      .map(toSummary)
  }

  async getItemDetail(humanId: HumanId, itemId: WorkItemId): Promise<WorkItemDetail> {
    return cloneItem(this.requireItem(humanId, itemId))
  }

  async moveItemToLane(humanId: HumanId, itemId: WorkItemId, lane: Lane): Promise<void> {
    const item = this.requireItem(humanId, itemId)
    this.replace(item.id, { ...item, lane })
  }

  async createWorkItem(
    humanId: HumanId,
    input: CreateWorkItemInput,
  ): Promise<WorkItemDetail> {
    const visible = visibleBoardIdsFor(humanId)

    if (!visible.has(input.boardId)) {
      throw new BoardAccessRefused(input.boardId)
    }

    const boardItems = this.items.filter((item) => item.boardId === input.boardId)
    const created: WorkItemDetail = {
      id: nextId('fictional-item-created', this.items.map((item) => item.id)),
      boardId: input.boardId,
      title: input.title,
      lane: input.lane,
      owner: input.owner ?? 'Unassigned',
      description: input.description ?? '',
      labels: [],
      assignees: [],
      priority: 'unset',
      dueDate: null,
      percentDone: 0,
      checklist: [],
      comments: [],
      attachments: [],
      coverColour: null,
      position: input.position ?? boardItems.length,
      externalReferences: [],
    }
    this.items = [...this.items, created]
    return cloneItem(created)
  }

  async updateWorkItem(
    humanId: HumanId,
    itemId: WorkItemId,
    input: UpdateWorkItemInput,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    return this.replace(item.id, { ...item, ...input })
  }

  async deleteWorkItem(humanId: HumanId, itemId: WorkItemId): Promise<void> {
    this.requireItem(humanId, itemId)
    this.items = this.items.filter((candidate) => candidate.id !== itemId)
  }

  async reorderWorkItem(
    humanId: HumanId,
    itemId: WorkItemId,
    input: ReorderWorkItemInput,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    return this.replace(item.id, { ...item, lane: input.lane, position: input.position })
  }

  async createComment(
    humanId: HumanId,
    itemId: WorkItemId,
    input: CreateCommentInput,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    const now = '2026-08-27T12:00:00.000Z'
    const comment: WorkItemComment = {
      id: nextId('fictional-comment', item.comments.map((entry) => entry.id)),
      author: input.author,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    }
    return this.replace(item.id, { ...item, comments: [...item.comments, comment] })
  }

  async updateComment(
    humanId: HumanId,
    itemId: WorkItemId,
    commentId: CommentId,
    body: string,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    if (!item.comments.some((comment) => comment.id === commentId)) {
      throw new WorkItemAccessRefused(itemId)
    }
    return this.replace(item.id, {
      ...item,
      comments: item.comments.map((comment) =>
        comment.id === commentId
          ? { ...comment, body, updatedAt: '2026-08-27T12:05:00.000Z' }
          : comment,
      ),
    })
  }

  async deleteComment(
    humanId: HumanId,
    itemId: WorkItemId,
    commentId: CommentId,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    if (!item.comments.some((comment) => comment.id === commentId)) {
      throw new WorkItemAccessRefused(itemId)
    }
    return this.replace(item.id, {
      ...item,
      comments: item.comments.filter((comment) => comment.id !== commentId),
    })
  }

  async addAttachment(
    humanId: HumanId,
    itemId: WorkItemId,
    input: CreateAttachmentInput,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    const attachment: WorkItemAttachment = {
      id: nextId('fictional-attachment', item.attachments.map((entry) => entry.id)),
      name: input.name,
      size: input.size,
      mimeType: input.mimeType,
      ...(input.file === undefined ? {} : { file: input.file }),
    }
    return this.replace(item.id, {
      ...item,
      attachments: [...item.attachments, attachment],
    })
  }

  async deleteAttachment(
    humanId: HumanId,
    itemId: WorkItemId,
    attachmentId: AttachmentId,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    if (!item.attachments.some((attachment) => attachment.id === attachmentId)) {
      throw new WorkItemAccessRefused(itemId)
    }
    return this.replace(item.id, {
      ...item,
      attachments: item.attachments.filter((attachment) => attachment.id !== attachmentId),
    })
  }

  async createChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    title: string,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    const checklistItem: ChecklistItem = {
      id: nextId('fictional-check', item.checklist.map((entry) => entry.id)),
      title,
      done: false,
      position: item.checklist.length,
    }
    return this.replace(item.id, {
      ...item,
      checklist: [...item.checklist, checklistItem],
    })
  }

  async updateChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    checklistItemId: ChecklistItemId,
    input: UpdateChecklistItemInput,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    if (!item.checklist.some((entry) => entry.id === checklistItemId)) {
      throw new WorkItemAccessRefused(itemId)
    }
    return this.replace(item.id, {
      ...item,
      checklist: item.checklist.map((entry) =>
        entry.id === checklistItemId ? { ...entry, ...input } : entry,
      ),
    })
  }

  async reorderChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    checklistItemId: ChecklistItemId,
    position: number,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    const current = item.checklist.findIndex((entry) => entry.id === checklistItemId)
    if (current === -1) {
      throw new WorkItemAccessRefused(itemId)
    }
    const next = item.checklist.slice()
    const [moved] = next.splice(current, 1)
    if (moved === undefined) {
      throw new WorkItemAccessRefused(itemId)
    }
    next.splice(Math.max(0, Math.min(position, next.length)), 0, moved)
    return this.replace(item.id, { ...item, checklist: reindexChecklist(next) })
  }

  async deleteChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    checklistItemId: ChecklistItemId,
  ): Promise<WorkItemDetail> {
    const item = this.requireItem(humanId, itemId)
    if (!item.checklist.some((entry) => entry.id === checklistItemId)) {
      throw new WorkItemAccessRefused(itemId)
    }
    return this.replace(item.id, {
      ...item,
      checklist: reindexChecklist(
        item.checklist.filter((entry) => entry.id !== checklistItemId),
      ),
    })
  }

  private requireItem(humanId: HumanId, itemId: WorkItemId): WorkItemDetail {
    const visible = visibleBoardIdsFor(humanId)
    const item = this.items.find((candidate) => candidate.id === itemId)

    if (item === undefined || !visible.has(item.boardId)) {
      throw new WorkItemAccessRefused(itemId)
    }

    return item
  }

  private replace(itemId: WorkItemId, next: WorkItemDetail): WorkItemDetail {
    this.items = this.items.map((candidate) =>
      candidate.id === itemId ? next : candidate,
    )
    return cloneItem(next)
  }
}

export function createFixtureTaskGateway(): TaskGateway {
  return new FixtureTaskGateway()
}
