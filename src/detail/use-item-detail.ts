import { ref, watch, type Ref } from 'vue'
import type { Lane } from '@/domain/lanes'
import type {
  AttachmentId,
  CardClosure,
  CardEvent,
  CardLinkId,
  ChecklistItemId,
  CommentId,
  CreateAttachmentInput,
  CreateCardLinkInput,
  HumanId,
  UpdateChecklistItemInput,
  UpdateWorkItemInput,
  WorkItemDetail,
  WorkItemId,
} from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import { WorkItemAccessRefused } from '@/gateway/refusals'

/**
 * `refused` is kept apart from `error` because they are different facts about
 * the Colony: a refusal says this human may not open that item, and an error
 * says the read failed. Collapsing them would let a broken read read as a
 * permission boundary, which is the more alarming of the two to show wrongly.
 */
export type ItemDetailStatus = 'idle' | 'loading' | 'ready' | 'refused' | 'error'
export type DetailReadStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * The detail of one opened item, and only of the opened one.
 *
 * The board payload stays compact: `getBoardItems` returns summaries, and the
 * fields that let a human resume work — handover, blocker, evidence — are
 * fetched here, once, when an item is opened. Nothing is prefetched for a card
 * that was never opened, and nothing is taken from the board payload, so a
 * board of two hundred items costs two hundred summaries and no details.
 */
export interface ItemDetail {
  readonly status: Readonly<Ref<ItemDetailStatus>>
  readonly item: Readonly<Ref<WorkItemDetail | null>>
  readonly updateError: Readonly<Ref<string | null>>
  readonly historyStatus: Readonly<Ref<DetailReadStatus>>
  readonly historyEvents: Readonly<Ref<readonly CardEvent[]>>
  readonly historyHasEarlier: Readonly<Ref<boolean>>
  readonly outcomeStatus: Readonly<Ref<DetailReadStatus>>
  readonly outcomeClosures: Readonly<Ref<readonly CardClosure[]>>
  loadEarlierEvents(): Promise<void>
  retryHistory(): void
  retryOutcome(): void
  updateItem(input: UpdateWorkItemInput): Promise<WorkItemDetail | null>
  createChecklistItem(title: string): Promise<WorkItemDetail | null>
  updateChecklistItem(
    checklistItemId: ChecklistItemId,
    input: UpdateChecklistItemInput,
  ): Promise<WorkItemDetail | null>
  reorderChecklistItem(
    checklistItemId: ChecklistItemId,
    position: number,
  ): Promise<WorkItemDetail | null>
  deleteChecklistItem(checklistItemId: ChecklistItemId): Promise<WorkItemDetail | null>
  createComment(author: string, body: string): Promise<WorkItemDetail | null>
  updateComment(commentId: CommentId, body: string): Promise<WorkItemDetail | null>
  deleteComment(commentId: CommentId): Promise<WorkItemDetail | null>
  addAttachment(input: CreateAttachmentInput): Promise<WorkItemDetail | null>
  deleteAttachment(attachmentId: AttachmentId): Promise<WorkItemDetail | null>
  addCardLink(input: CreateCardLinkInput): Promise<WorkItemDetail | null>
  removeCardLink(linkId: CardLinkId): Promise<WorkItemDetail | null>
  applyLane(itemId: WorkItemId, lane: Lane): void
}

export function useItemDetail(
  gateway: TaskGateway,
  humanId: Readonly<Ref<HumanId | null>>,
  selectedItemId: Readonly<Ref<WorkItemId | null>>,
): ItemDetail {
  const status = ref<ItemDetailStatus>('idle')
  const item = ref<WorkItemDetail | null>(null)
  const updateError = ref<string | null>(null)
  const historyStatus = ref<DetailReadStatus>('idle')
  const historyEvents = ref<readonly CardEvent[]>([])
  const historyCursor = ref<string | null>(null)
  const historyHasEarlier = ref(false)
  const outcomeStatus = ref<DetailReadStatus>('idle')
  const outcomeClosures = ref<readonly CardClosure[]>([])

  function clearMemoryReads(): void {
    historyStatus.value = 'idle'
    historyEvents.value = []
    historyCursor.value = null
    historyHasEarlier.value = false
    outcomeStatus.value = 'idle'
    outcomeClosures.value = []
  }

  function stillSelected(currentHumanId: HumanId, itemId: WorkItemId): boolean {
    return humanId.value === currentHumanId && selectedItemId.value === itemId
  }

  async function loadHistory(currentHumanId: HumanId, itemId: WorkItemId): Promise<void> {
    historyStatus.value = 'loading'
    try {
      const page = gateway.listCardEvents === undefined
        ? { items: [], nextCursor: null }
        : await gateway.listCardEvents(currentHumanId, itemId, undefined, 20)
      if (!stillSelected(currentHumanId, itemId) || status.value !== 'ready') {
        return
      }

      historyEvents.value = [...page.items].reverse()
      historyCursor.value = page.nextCursor
      historyHasEarlier.value = page.nextCursor !== null
      historyStatus.value = 'ready'
    } catch (error: unknown) {
      if (!stillSelected(currentHumanId, itemId)) {
        return
      }

      historyEvents.value = []
      historyCursor.value = null
      historyHasEarlier.value = false
      if (error instanceof WorkItemAccessRefused) {
        item.value = null
        status.value = 'refused'
        clearMemoryReads()
        return
      }

      historyStatus.value = 'error'
    }
  }

  async function loadOutcome(currentHumanId: HumanId, itemId: WorkItemId): Promise<void> {
    outcomeStatus.value = 'loading'
    try {
      const page = gateway.listCardClosures === undefined
        ? { items: [], nextCursor: null }
        : await gateway.listCardClosures(currentHumanId, itemId, undefined, 100)
      if (!stillSelected(currentHumanId, itemId) || status.value !== 'ready') {
        return
      }

      outcomeClosures.value = page.items
      outcomeStatus.value = 'ready'
    } catch (error: unknown) {
      if (!stillSelected(currentHumanId, itemId)) {
        return
      }

      outcomeClosures.value = []
      if (error instanceof WorkItemAccessRefused) {
        item.value = null
        status.value = 'refused'
        clearMemoryReads()
        return
      }

      outcomeStatus.value = 'error'
    }
  }

  async function loadEarlierEvents(): Promise<void> {
    const currentHumanId = humanId.value
    const itemId = selectedItemId.value
    const cursor = historyCursor.value
    if (
      currentHumanId === null ||
      itemId === null ||
      cursor === null ||
      gateway.listCardEvents === undefined
    ) {
      return
    }

    historyStatus.value = 'loading'
    try {
      const page = await gateway.listCardEvents(currentHumanId, itemId, cursor, 20)
      if (!stillSelected(currentHumanId, itemId)) {
        return
      }

      const known = new Set(historyEvents.value.map((event) => event.id))
      const earlier = [...page.items].reverse().filter((event) => !known.has(event.id))
      historyEvents.value = [...earlier, ...historyEvents.value]
      historyCursor.value = page.nextCursor
      historyHasEarlier.value = page.nextCursor !== null
      historyStatus.value = 'ready'
    } catch (error: unknown) {
      if (!stillSelected(currentHumanId, itemId)) {
        return
      }

      if (error instanceof WorkItemAccessRefused) {
        item.value = null
        status.value = 'refused'
        clearMemoryReads()
        return
      }

      historyStatus.value = 'error'
    }
  }

  function retryHistory(): void {
    const currentHumanId = humanId.value
    const itemId = selectedItemId.value
    if (currentHumanId !== null && itemId !== null) {
      void loadHistory(currentHumanId, itemId)
    }
  }

  function retryOutcome(): void {
    const currentHumanId = humanId.value
    const itemId = selectedItemId.value
    if (currentHumanId !== null && itemId !== null) {
      void loadOutcome(currentHumanId, itemId)
    }
  }

  async function load(): Promise<void> {
    const currentHumanId = humanId.value
    const itemId = selectedItemId.value

    item.value = null
    updateError.value = null
    clearMemoryReads()
    if (currentHumanId === null || itemId === null) {
      status.value = 'idle'
      return
    }

    status.value = 'loading'

    let detail: WorkItemDetail

    try {
      detail = await gateway.getItemDetail(currentHumanId, itemId)
    } catch (error: unknown) {
      if (humanId.value !== currentHumanId || selectedItemId.value !== itemId) {
        return
      }

      status.value = error instanceof WorkItemAccessRefused ? 'refused' : 'error'
      return
    }

    if (humanId.value !== currentHumanId || selectedItemId.value !== itemId) {
      return
    }

    item.value = detail
    status.value = 'ready'
    void loadHistory(currentHumanId, itemId)
    void loadOutcome(currentHumanId, itemId)
  }

  watch([humanId, selectedItemId], () => void load(), { immediate: true })

  async function writeDetail(
    current: WorkItemDetail,
    currentHumanId: HumanId,
    run: () => Promise<WorkItemDetail>,
    optimistic?: WorkItemDetail,
  ): Promise<WorkItemDetail | null> {
    const previous = current
    updateError.value = null

    if (optimistic !== undefined) {
      item.value = optimistic
    }

    try {
      const updated = await run()

      if (humanId.value === currentHumanId && selectedItemId.value === current.id) {
        item.value = updated
      }

      return updated
    } catch {
      if (humanId.value === currentHumanId && selectedItemId.value === current.id) {
        item.value = previous
      }

      updateError.value = 'Updating this work item failed.'
      return null
    }
  }

  async function updateItem(input: UpdateWorkItemInput): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value

    if (currentHumanId === null || current === null) {
      return null
    }

    return writeDetail(current, currentHumanId, () =>
      gateway.updateWorkItem(currentHumanId, current.id, input),
    )
  }

  async function createChecklistItem(title: string): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value
    const trimmed = title.trim()

    if (currentHumanId === null || current === null || trimmed === '') {
      return null
    }

    return writeDetail(current, currentHumanId, () =>
      gateway.createChecklistItem(currentHumanId, current.id, trimmed),
    )
  }

  async function updateChecklistItem(
    checklistItemId: ChecklistItemId,
    input: UpdateChecklistItemInput,
  ): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value

    if (currentHumanId === null || current === null) {
      return null
    }

    const optimistic: WorkItemDetail = {
      ...current,
      checklist: current.checklist.map((entry) =>
        entry.id === checklistItemId ? { ...entry, ...input } : entry,
      ),
    }

    return writeDetail(
      current,
      currentHumanId,
      () =>
        gateway.updateChecklistItem(currentHumanId, current.id, checklistItemId, input),
      optimistic,
    )
  }

  async function reorderChecklistItem(
    checklistItemId: ChecklistItemId,
    position: number,
  ): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value

    if (currentHumanId === null || current === null) {
      return null
    }

    return writeDetail(current, currentHumanId, () =>
      gateway.reorderChecklistItem(currentHumanId, current.id, checklistItemId, position),
    )
  }

  async function deleteChecklistItem(
    checklistItemId: ChecklistItemId,
  ): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value

    if (currentHumanId === null || current === null) {
      return null
    }

    return writeDetail(current, currentHumanId, () =>
      gateway.deleteChecklistItem(currentHumanId, current.id, checklistItemId),
    )
  }

  async function createComment(author: string, body: string): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value
    const trimmed = body.trim()

    if (currentHumanId === null || current === null || author.trim() === '' || trimmed === '') {
      return null
    }

    return writeDetail(current, currentHumanId, () =>
      gateway.createComment(currentHumanId, current.id, { author, body: trimmed }),
    )
  }

  async function updateComment(commentId: CommentId, body: string): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value
    const trimmed = body.trim()

    if (currentHumanId === null || current === null || trimmed === '') {
      return null
    }

    return writeDetail(current, currentHumanId, () =>
      gateway.updateComment(currentHumanId, current.id, commentId, trimmed),
    )
  }

  async function deleteComment(commentId: CommentId): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value

    if (currentHumanId === null || current === null) {
      return null
    }

    return writeDetail(current, currentHumanId, () =>
      gateway.deleteComment(currentHumanId, current.id, commentId),
    )
  }

  async function addAttachment(input: CreateAttachmentInput): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value

    if (currentHumanId === null || current === null) {
      return null
    }

    return writeDetail(current, currentHumanId, () =>
      gateway.addAttachment(currentHumanId, current.id, input),
    )
  }

  async function deleteAttachment(attachmentId: AttachmentId): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value

    if (currentHumanId === null || current === null) {
      return null
    }

    return writeDetail(current, currentHumanId, () =>
      gateway.deleteAttachment(currentHumanId, current.id, attachmentId),
    )
  }

  async function addCardLink(input: CreateCardLinkInput): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value
    const ref = input.ref.trim()
    const note = input.note?.trim()

    if (currentHumanId === null || current === null || ref === '') {
      return null
    }

    return writeDetail(current, currentHumanId, async () => {
      const created = await gateway.addCardLink(currentHumanId, current.id, {
        kind: input.kind,
        ref,
        ...(note === undefined || note === '' ? {} : { note }),
      })
      if (current.links.some((link) => link.id === created.id)) {
        return current
      }
      return { ...current, links: [...current.links, created] }
    })
  }

  async function removeCardLink(linkId: CardLinkId): Promise<WorkItemDetail | null> {
    const currentHumanId = humanId.value
    const current = item.value

    if (currentHumanId === null || current === null) {
      return null
    }

    return writeDetail(current, currentHumanId, async () => {
      await gateway.removeCardLink(currentHumanId, linkId)
      return { ...current, links: current.links.filter((link) => link.id !== linkId) }
    })
  }

  return {
    status,
    item,
    updateError,
    historyStatus,
    historyEvents,
    historyHasEarlier,
    outcomeStatus,
    outcomeClosures,
    loadEarlierEvents,
    retryHistory,
    retryOutcome,
    updateItem,
    createChecklistItem,
    updateChecklistItem,
    reorderChecklistItem,
    deleteChecklistItem,
    createComment,
    updateComment,
    deleteComment,
    addAttachment,
    deleteAttachment,
    addCardLink,
    removeCardLink,
    applyLane(itemId: WorkItemId, lane: Lane): void {
      const current = item.value

      if (current !== null && current.id === itemId) {
        item.value = { ...current, lane }
      }
    },
  }
}
