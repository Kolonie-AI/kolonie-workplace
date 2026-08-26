import type { ExternalReference, Handover } from '@/domain/workplace'

/**
 * The five handover parts, in the order the Colony's handover contract states
 * them, each with the label the pane renders. They are fixed: whenever a
 * handover exists the pane renders all five, so a part that was left empty
 * reads as an empty part rather than as a part nobody defined.
 */
export const HANDOVER_PARTS = [
  'done',
  'learned',
  'next',
  'blocked',
  'evidence',
] as const

export type HandoverPart = (typeof HANDOVER_PARTS)[number]

export const HANDOVER_PART_LABELS: Readonly<Record<HandoverPart, string>> = {
  done: 'Done',
  learned: 'Learned',
  next: 'Next',
  blocked: 'Blocked',
  evidence: 'Evidence',
}

export const HANDOVER_PART_ABSENT = 'Not recorded'

/**
 * A prose part carries one line of text; `evidence` carries links. They are
 * kept apart in the type rather than flattened to strings, because the pane
 * renders evidence as anchors to the external target and text as text.
 */
export interface RenderedHandoverPart {
  readonly part: HandoverPart
  readonly label: string
  readonly text: string | null
  readonly links: readonly ExternalReference[]
}

export function renderHandover(handover: Handover): readonly RenderedHandoverPart[] {
  return HANDOVER_PARTS.map((part) => {
    const label = HANDOVER_PART_LABELS[part]

    if (part === 'evidence') {
      return handover.evidence.length === 0
        ? { part, label, text: HANDOVER_PART_ABSENT, links: [] }
        : { part, label, text: null, links: handover.evidence }
    }

    const value = handover[part]

    return {
      part,
      label,
      text: value.trim().length === 0 ? HANDOVER_PART_ABSENT : value,
      links: [],
    }
  })
}
