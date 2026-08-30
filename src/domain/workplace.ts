/**
 * Workplace-owned, disposable types for the UI-first spike.
 *
 * These types are not a `kolonie-platform` schema proposal. They describe only
 * the fixture-backed workplace surface and are expected to be replaced when a
 * generated platform client exists.
 */

import type { Lane } from '@/domain/lanes'

export type HumanId = string
export type AgentId = string
export type BoardId = string

export interface Human {
  readonly id: HumanId
  readonly name: string
  readonly agentIds: readonly AgentId[]
}

export interface Agent {
  readonly id: AgentId
  readonly name: string
  readonly profession: string | null
  readonly boardIds: readonly BoardId[]
}

export interface Board {
  readonly id: BoardId
  readonly agentId: AgentId
  readonly title: string
}

export interface VisibleBoard extends Board {
  readonly agentName: string
  readonly profession: string | null
}

export type WorkItemId = string
export type LabelId = string
export type CommentId = string
export type AttachmentId = string
export type ChecklistItemId = string

export type WorkItemPriority = 'unset' | 'low' | 'medium' | 'high' | 'urgent' | 'do_now'

export interface WorkItemLabel {
  readonly id: LabelId
  readonly title: string
  readonly colour: string
}

export interface WorkItemAssignee {
  readonly id: string
  readonly name: string
}

export interface ChecklistItem {
  readonly id: ChecklistItemId
  readonly title: string
  readonly done: boolean
  readonly position: number
}

export interface WorkItemComment {
  readonly id: CommentId
  readonly author: string
  readonly body: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface WorkItemAttachment {
  readonly id: AttachmentId
  readonly name: string
  readonly size: number
  readonly mimeType: string
  readonly file?: File
}

export interface ExternalReference {
  readonly label: string
  readonly href: string
}

export interface Blocker {
  readonly actor: string
  readonly smallestUnblock: string
}

export interface Handover {
  readonly done: string
  readonly learned: string
  readonly next: string
  readonly blocked: string
  readonly evidence: readonly ExternalReference[]
}

export interface WorkItemSummary {
  readonly id: WorkItemId
  readonly boardId: BoardId
  readonly title: string
  readonly lane: Lane
  readonly owner: string
  readonly description: string
  readonly labels: readonly WorkItemLabel[]
  readonly assignees: readonly WorkItemAssignee[]
  readonly priority: WorkItemPriority
  readonly dueDate: string | null
  readonly percentDone: number
  readonly checklist: readonly ChecklistItem[]
  readonly comments: readonly WorkItemComment[]
  readonly attachments: readonly WorkItemAttachment[]
  readonly coverColour: string | null
  readonly coverImageUrl: string | null
  readonly coverAttachmentId: AttachmentId | null
  readonly position: number
}

export interface WorkItemDetail extends WorkItemSummary {
  readonly blocker?: Blocker
  readonly handover?: Handover
  readonly externalReferences: readonly ExternalReference[]
}

export interface CreateWorkItemInput {
  readonly boardId: BoardId
  readonly title: string
  readonly lane: Lane
  readonly owner?: string
  readonly description?: string
  readonly position?: number
}

export type UpdateWorkItemInput = Partial<
  Pick<
    WorkItemDetail,
    | 'title'
    | 'lane'
    | 'owner'
    | 'description'
    | 'labels'
    | 'assignees'
    | 'priority'
    | 'dueDate'
    | 'percentDone'
    | 'coverColour'
    | 'coverImageUrl'
    | 'coverAttachmentId'
    | 'position'
    | 'blocker'
    | 'handover'
    | 'externalReferences'
  >
>

export interface WorkItemMoveInput {
  readonly lane: Lane
  readonly position?: number
  readonly blockedBy?: string
  readonly unblockWhen?: string
  readonly outcome?: string
}

export interface ReorderWorkItemInput {
  readonly lane: Lane
  readonly position: number
}

export interface CreateCommentInput {
  readonly author: string
  readonly body: string
}

export interface CreateAttachmentInput {
  readonly name: string
  readonly size: number
  readonly mimeType: string
  readonly file?: File
}

export type UpdateChecklistItemInput = Partial<
  Pick<ChecklistItem, 'title' | 'done'>
>
