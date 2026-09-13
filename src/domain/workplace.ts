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
  readonly kind?: 'default' | 'additional'
}

export type WorkItemId = string
export type LabelId = string
export type CommentId = string
export type AttachmentId = string
export type ChecklistItemId = string
export type CardLinkId = string

export const WORKPLACE_LINK_KINDS = [
  'account',
  'provider',
  'vault',
  'task',
  'playbook',
  'url',
] as const

export type CardLinkKind = (typeof WORKPLACE_LINK_KINDS)[number]

export function isCardLinkKind(candidate: string): candidate is CardLinkKind {
  return (WORKPLACE_LINK_KINDS as readonly string[]).includes(candidate)
}

export const WORKPLACE_LINK_KIND_LABELS: Readonly<Record<CardLinkKind, string>> = {
  account: 'Account',
  provider: 'Provider',
  vault: 'Vault',
  task: 'Task',
  playbook: 'Playbook',
  url: 'URL',
}

export type CardLinkState = 'resolved' | 'unresolvable'

export interface CardLink {
  readonly id: CardLinkId
  readonly kind: CardLinkKind
  readonly ref: string
  readonly note?: string
  readonly state: CardLinkState
  readonly summary: string
}

export interface CreateCardLinkInput {
  readonly kind: CardLinkKind
  readonly ref: string
  readonly note?: string
}

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
  readonly links: readonly CardLink[]
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

export const WORKPLACE_CARD_EVENT_VERBS = [
  'card.created',
  'card.updated',
  'card.claimed',
  'card.moved',
  'card.blocked',
  'card.review_requested',
  'card.closed',
  'card.handover_started',
  'card.archived',
  'card.label_attached',
  'card.label_detached',
  'card.checklist_created',
  'card.checklist_updated',
  'card.checklist_deleted',
  'card.checklist_item_created',
  'card.checklist_item_updated',
  'card.checklist_item_deleted',
  'card.comment_created',
  'card.comment_updated',
  'card.comment_deleted',
  'card.link_created',
  'card.link_deleted',
] as const

export type CardEventVerb = (typeof WORKPLACE_CARD_EVENT_VERBS)[number]

export const WORKPLACE_EVENT_ACTOR_KINDS = ['citizen', 'human-linked', 'system'] as const

export type CardEventActorKind = (typeof WORKPLACE_EVENT_ACTOR_KINDS)[number]

export interface CardEvent {
  readonly id: string
  readonly boardId: BoardId
  readonly cardId: WorkItemId
  readonly actorId: string | null
  readonly actorKind: CardEventActorKind
  readonly actorHumanId: string | null
  readonly subjectAgentId: string | null
  readonly delegationId: string | null
  readonly verb: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly legacy: boolean
  readonly createdAt: string
}

export interface CardEventPage {
  readonly items: readonly CardEvent[]
  readonly nextCursor: string | null
}

export const WORKPLACE_CARD_CLOSURE_RESULTS = [
  'shipped',
  'failed_experiment',
  'abandoned',
  'superseded',
] as const

export type CardClosureResult = (typeof WORKPLACE_CARD_CLOSURE_RESULTS)[number]

export type CardClosureNext =
  | { readonly kind: 'none' }
  | { readonly kind: 'card'; readonly cardId: WorkItemId }
  | { readonly kind: 'sentence'; readonly text: string }

export interface CardClosure {
  readonly id: string
  readonly boardId: BoardId
  readonly cardId: WorkItemId
  readonly actorId: string | null
  readonly revision: number
  readonly result: CardClosureResult
  readonly summary: string
  readonly learned: string
  readonly evidenceLinkIds: readonly CardLinkId[]
  readonly evidenceLinks: readonly CardLink[]
  readonly next: CardClosureNext
  readonly legacy: boolean
  readonly supersedesClosureId: string | null
  readonly createdAt: string
}

export interface CardClosurePage {
  readonly items: readonly CardClosure[]
  readonly nextCursor: string | null
}
