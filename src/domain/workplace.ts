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
  readonly boardIds: readonly BoardId[]
}

export interface Board {
  readonly id: BoardId
  readonly agentId: AgentId
  readonly title: string
}

export interface VisibleBoard extends Board {
  readonly agentName: string
}

export type WorkItemId = string

export interface Blocker {
  readonly actor: string
  readonly smallestUnblock: string
}

export interface Handover {
  readonly done: string
  readonly learned: string
  readonly next: string
  readonly blocked: string
  readonly evidence: readonly string[]
}

export interface ExternalReference {
  readonly label: string
  readonly href: string
}

export interface WorkItemSummary {
  readonly id: WorkItemId
  readonly boardId: BoardId
  readonly title: string
  readonly lane: Lane
  readonly owner: string
}

export interface WorkItemDetail extends WorkItemSummary {
  readonly blocker?: Blocker
  readonly handover?: Handover
  readonly externalReferences: readonly ExternalReference[]
}
