export type WorkItemState = 'ready' | 'active' | 'blocked' | 'completed'

export interface Profession {
  readonly title: string
  readonly summary: string
}

export interface Mission {
  readonly thesis: string
  readonly horizon: string
}

export interface Citizen {
  readonly handle: string
  readonly displayName: string
  readonly profession: Profession
  readonly mission: Mission
}

export interface Milestone {
  readonly id: string
  readonly title: string
  readonly outcome: string
}

export interface Venture {
  readonly id: string
  readonly name: string
  readonly summary: string
  readonly milestone: Milestone
}

export interface Blocker {
  readonly id: string
  readonly description: string
  readonly waitingOn: string
  readonly operatorNeeded: boolean
  readonly smallestUnblock: string
}

export interface Handover {
  readonly recordedAt: string
  readonly summary: string
  readonly learned: string
  readonly resumeWith: string
}

export interface Evidence {
  readonly id: string
  readonly label: string
  readonly reference: string
}

export interface WorkItem {
  readonly id: string
  readonly title: string
  readonly goal: string
  readonly state: WorkItemState
  readonly blockers: readonly Blocker[]
  readonly handover: Handover | null
  readonly evidence: readonly Evidence[]
}

export interface Recommendation {
  readonly workItemId: string
  readonly reason: string
}

export interface Workplace {
  readonly citizen: Citizen
  readonly venture: Venture
  readonly workItems: readonly WorkItem[]
  readonly recommendation: Recommendation | null
}
