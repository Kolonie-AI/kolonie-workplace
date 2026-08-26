export const WORKPLACE_VIEWS = ['kanban', 'list'] as const

export type WorkplaceView = (typeof WORKPLACE_VIEWS)[number]

export const WORKPLACE_VIEW_LABELS: Readonly<Record<WorkplaceView, string>> = {
  kanban: 'Kanban',
  list: 'List',
}

export const DEFAULT_WORKPLACE_VIEW: WorkplaceView = 'kanban'

export function isWorkplaceView(candidate: string): candidate is WorkplaceView {
  return (WORKPLACE_VIEWS as readonly string[]).includes(candidate)
}

export function resolveWorkplaceView(candidate: unknown): WorkplaceView {
  return typeof candidate === 'string' && isWorkplaceView(candidate)
    ? candidate
    : DEFAULT_WORKPLACE_VIEW
}
