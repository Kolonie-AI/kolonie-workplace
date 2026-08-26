import { ref, watch, type Ref } from 'vue'
import type { HumanId, WorkItemDetail, WorkItemId } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import { WorkItemAccessRefused } from '@/gateway/refusals'

/**
 * `refused` is kept apart from `error` because they are different facts about
 * the Colony: a refusal says this human may not open that item, and an error
 * says the read failed. Collapsing them would let a broken read read as a
 * permission boundary, which is the more alarming of the two to show wrongly.
 */
export type ItemDetailStatus = 'idle' | 'loading' | 'ready' | 'refused' | 'error'

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
}

export function useItemDetail(
  gateway: TaskGateway,
  humanId: Readonly<Ref<HumanId | null>>,
  selectedItemId: Readonly<Ref<WorkItemId | null>>,
): ItemDetail {
  const status = ref<ItemDetailStatus>('idle')
  const item = ref<WorkItemDetail | null>(null)

  async function load(): Promise<void> {
    const currentHumanId = humanId.value
    const itemId = selectedItemId.value

    item.value = null

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
  }

  watch([humanId, selectedItemId], () => void load(), { immediate: true })

  return { status, item }
}
