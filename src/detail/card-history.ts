import type {
  CardClosureResult,
  CardEvent,
  CardEventActorKind,
} from '@/domain/workplace'

export const CARD_EVENT_VERB_LABELS: Readonly<Record<string, string>> = {
  'card.created': 'Created',
  'card.updated': 'Updated',
  'card.claimed': 'Claimed',
  'card.moved': 'Moved',
  'card.blocked': 'Blocked',
  'card.review_requested': 'Review requested',
  'card.closed': 'Closed',
  'card.handover_started': 'Handover started',
  'card.archived': 'Archived',
  'card.label_attached': 'Label attached',
  'card.label_detached': 'Label detached',
  'card.checklist_created': 'Checklist created',
  'card.checklist_updated': 'Checklist updated',
  'card.checklist_deleted': 'Checklist deleted',
  'card.checklist_item_created': 'Checklist item created',
  'card.checklist_item_updated': 'Checklist item updated',
  'card.checklist_item_deleted': 'Checklist item deleted',
  'card.comment_created': 'Comment created',
  'card.comment_updated': 'Comment updated',
  'card.comment_deleted': 'Comment deleted',
  'card.link_created': 'Connection created',
  'card.link_deleted': 'Connection deleted',
}

export const CARD_CLOSURE_RESULT_LABELS: Readonly<Record<CardClosureResult, string>> = {
  shipped: 'Shipped',
  failed_experiment: 'Failed experiment',
  abandoned: 'Abandoned',
  superseded: 'Superseded',
}

export function cardEventVerbLabel(verb: string): string {
  return CARD_EVENT_VERB_LABELS[verb] ?? verb
}

export function cardEventActorLabel(event: {
  readonly actorKind: CardEventActorKind
  readonly actorId: string | null
}): string {
  if (event.actorKind === 'system') {
    return 'System'
  }

  if (event.actorId === null) {
    return 'Deleted citizen'
  }

  if (event.actorKind === 'human-linked') {
    return 'Linked human'
  }

  return 'Citizen'
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'none'
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  return 'updated'
}

export function cardEventFieldSummary(event: CardEvent): readonly string[] {
  const payload = event.payload
  if (event.verb === 'card.updated') {
    const changes = payload.changes
    if (typeof changes !== 'object' || changes === null) {
      return []
    }

    return Object.entries(changes).flatMap(([field, value]) => {
      if (typeof value !== 'object' || value === null) {
        return []
      }

      const row = value as { readonly before?: unknown; readonly after?: unknown }
      return [`${field}: ${formatFieldValue(row.before)} → ${formatFieldValue(row.after)}`]
    })
  }

  const lines: string[] = []
  const fromStatus = payload.fromStatus
  const toStatus = payload.toStatus
  if (typeof fromStatus === 'string' && typeof toStatus === 'string') {
    lines.push(`${fromStatus} → ${toStatus}`)
  }

  const result = payload.result
  if (typeof result === 'string') {
    lines.push(result)
  }

  return lines
}

export function cardEventRelated(
  payload: Readonly<Record<string, unknown>>,
): readonly { readonly kind: 'closure' | 'handover'; readonly id: string }[] {
  const related: { readonly kind: 'closure' | 'handover'; readonly id: string }[] = []
  const closeRecordId = payload.closeRecordId
  if (typeof closeRecordId === 'string' && closeRecordId.length > 0) {
    related.push({ kind: 'closure', id: closeRecordId })
  }

  const handoverId = payload.handoverId
  if (typeof handoverId === 'string' && handoverId.length > 0) {
    related.push({ kind: 'handover', id: handoverId })
  }

  return related
}

export function evidenceHref(ref: string): string | null {
  try {
    const url = new URL(ref)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href
    }
  } catch {
    return null
  }

  return null
}
