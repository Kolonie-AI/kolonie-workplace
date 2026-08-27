import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { Lane } from '@/domain/lanes'
import type { BoardId, HumanId, WorkItemId, WorkItemSummary } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import {
  partitionIntoLanes,
  type InvalidLaneItem,
  type LaneColumn,
} from '@/items/lane-columns'
import { orderForList, type ListRow } from '@/items/list-rows'

/**
 * `loading` and `error` are kept distinct from `ready` with no items on
 * purpose, exactly as the board list keeps them: a board that holds nothing and
 * a read that failed must not render the same way.
 */
export type BoardItemsStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * The single loaded state behind every presentation of a board.
 *
 * Kanban and List are two shapes over one `useBoardItems`, not two data paths.
 * One gateway read, one foreign-board filter, one lane partition and one
 * selection ref serve both, which is what makes the tabs honest: a view cannot
 * fetch differently, filter differently or sort into a different set than its
 * sibling, because there is only one set. `columns` and `rows` are two orderings
 * of the same partitioned items and never of two different reads.
 *
 * A lane move updates that same set, so both views agree without a second
 * write path. The update is optimistic: a gateway refusal restores the
 * previous lane and surfaces the refusal rather than keeping a move the
 * gateway did not accept.
 */
export interface BoardItems {
  readonly status: Readonly<Ref<BoardItemsStatus>>
  readonly columns: ComputedRef<readonly LaneColumn[]>
  readonly rows: ComputedRef<readonly ListRow[]>
  readonly invalid: ComputedRef<readonly InvalidLaneItem[]>
  readonly foreign: ComputedRef<readonly WorkItemSummary[]>
  readonly isBoardEmpty: ComputedRef<boolean>
  readonly selectedItemId: Readonly<Ref<WorkItemId | null>>
  readonly movingItemId: Readonly<Ref<WorkItemId | null>>
  readonly moveError: Readonly<Ref<string | null>>
  selectItem(itemId: WorkItemId): void
  moveItem(itemId: WorkItemId, lane: Lane): Promise<void>
  clearSelection(): void
}

export function useBoardItems(
  gateway: TaskGateway,
  humanId: Readonly<Ref<HumanId | null>>,
  activeBoardId: Readonly<Ref<BoardId | null>>,
): BoardItems {
  const status = ref<BoardItemsStatus>('idle')
  const loaded = ref<readonly WorkItemSummary[]>([])
  const foreign = ref<readonly WorkItemSummary[]>([])
  const selectedItemId = ref<WorkItemId | null>(null)
  const movingItemId = ref<WorkItemId | null>(null)
  const moveError = ref<string | null>(null)

  async function load(): Promise<void> {
    const currentHumanId = humanId.value
    const boardId = activeBoardId.value

    loaded.value = []
    foreign.value = []
    selectedItemId.value = null
    movingItemId.value = null
    moveError.value = null

    if (currentHumanId === null || boardId === null) {
      status.value = 'idle'
      return
    }

    status.value = 'loading'

    let items: readonly WorkItemSummary[]

    try {
      items = await gateway.getBoardItems(currentHumanId, boardId)
    } catch {
      status.value = 'error'
      return
    }

    if (humanId.value !== currentHumanId || activeBoardId.value !== boardId) {
      return
    }

    loaded.value = items.filter((item) => item.boardId === boardId)
    foreign.value = items.filter((item) => item.boardId !== boardId)
    status.value = 'ready'
  }

  watch([humanId, activeBoardId], () => void load(), { immediate: true })

  const partition = computed(() => partitionIntoLanes(loaded.value))

  return {
    status,
    columns: computed(() => partition.value.columns),
    rows: computed(() => orderForList(partition.value.columns)),
    invalid: computed(() => partition.value.invalid),
    foreign: computed(() => foreign.value),
    isBoardEmpty: computed(
      () => status.value === 'ready' && loaded.value.length === 0,
    ),
    selectedItemId,
    movingItemId,
    moveError,
    selectItem(itemId: WorkItemId): void {
      selectedItemId.value = itemId
    },
    clearSelection(): void {
      selectedItemId.value = null
    },
    async moveItem(itemId: WorkItemId, lane: Lane): Promise<void> {
      const currentHumanId = humanId.value
      const current = loaded.value.find((item) => item.id === itemId)

      if (currentHumanId === null || current === undefined || current.lane === lane) {
        return
      }

      const previousLane = current.lane
      moveError.value = null
      movingItemId.value = itemId
      loaded.value = loaded.value.map((item) =>
        item.id === itemId ? { ...item, lane } : item,
      )

      try {
        await gateway.moveItemToLane(currentHumanId, itemId, lane)
      } catch (error) {
        loaded.value = loaded.value.map((item) =>
          item.id === itemId ? { ...item, lane: previousLane } : item,
        )
        moveError.value =
          error instanceof Error ? error.message : 'The move was refused.'
      } finally {
        movingItemId.value = null
      }
    },
  }
}
