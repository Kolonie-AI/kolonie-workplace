import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { Lane } from '@/domain/lanes'
import type {
  BoardId,
  HumanId,
  WorkItemDetail,
  WorkItemId,
  WorkItemSummary,
} from '@/domain/workplace'
import { BoardAccessRefused } from '@/gateway/refusals'
import type { TaskGateway } from '@/gateway/task-gateway'
import { applyBoardFilter, EMPTY_BOARD_FILTER, type BoardFilter } from '@/items/board-filter'
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
 * A lane move or a within-lane reorder updates that same set, so both views
 * agree without a second write path. The update is optimistic: a gateway
 * refusal restores the previous lane and order and surfaces the refusal
 * rather than keeping a write the gateway did not accept.
 */
export interface BoardItems {
  readonly status: Readonly<Ref<BoardItemsStatus>>
  readonly columns: ComputedRef<readonly LaneColumn[]>
  readonly rows: ComputedRef<readonly ListRow[]>
  readonly invalid: ComputedRef<readonly InvalidLaneItem[]>
  readonly foreign: ComputedRef<readonly WorkItemSummary[]>
  readonly loadedItems: ComputedRef<readonly WorkItemSummary[]>
  readonly isBoardEmpty: ComputedRef<boolean>
  readonly isFilterEmpty: ComputedRef<boolean>
  readonly selectedItemId: Readonly<Ref<WorkItemId | null>>
  readonly movingItemId: Readonly<Ref<WorkItemId | null>>
  readonly moveError: Readonly<Ref<string | null>>
  readonly createError: Readonly<Ref<string | null>>
  selectItem(itemId: WorkItemId): void
  moveItem(itemId: WorkItemId, lane: Lane, position?: number): Promise<void>
  reorderItem(itemId: WorkItemId, lane: Lane, position: number): Promise<void>
  createItem(title: string, lane: Lane): Promise<void>
  replaceItem(item: WorkItemSummary): void
  clearSelection(): void
}

export function useBoardItems(
  gateway: TaskGateway,
  humanId: Readonly<Ref<HumanId | null>>,
  activeBoardId: Readonly<Ref<BoardId | null>>,
  boardFilter: Readonly<Ref<BoardFilter>> = ref(EMPTY_BOARD_FILTER),
  now: () => Date = () => new Date(),
): BoardItems {
  const status = ref<BoardItemsStatus>('idle')
  const loaded = ref<readonly WorkItemSummary[]>([])
  const foreign = ref<readonly WorkItemSummary[]>([])
  const selectedItemId = ref<WorkItemId | null>(null)
  const movingItemId = ref<WorkItemId | null>(null)
  const moveError = ref<string | null>(null)
  const createError = ref<string | null>(null)
  let optimisticSequence = 0

  async function load(): Promise<void> {
    const currentHumanId = humanId.value
    const boardId = activeBoardId.value

    loaded.value = []
    foreign.value = []
    selectedItemId.value = null
    movingItemId.value = null
    moveError.value = null
    createError.value = null

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

  const filtered = computed(() => applyBoardFilter(loaded.value, boardFilter.value, now()))
  const partition = computed(() => partitionIntoLanes(filtered.value))

  return {
    status,
    columns: computed(() => partition.value.columns),
    rows: computed(() => orderForList(partition.value.columns)),
    invalid: computed(() => partition.value.invalid),
    foreign: computed(() => foreign.value),
    loadedItems: computed(() => loaded.value),
    isBoardEmpty: computed(
      () => status.value === 'ready' && loaded.value.length === 0,
    ),
    isFilterEmpty: computed(
      () =>
        status.value === 'ready' &&
        loaded.value.length > 0 &&
        filtered.value.length === 0,
    ),
    selectedItemId,
    movingItemId,
    moveError,
    createError,
    replaceItem(item: WorkItemSummary): void {
      loaded.value = loaded.value.map((current) =>
        current.id === item.id ? item : current,
      )
    },
    selectItem(itemId: WorkItemId): void {
      selectedItemId.value = itemId
    },
    clearSelection(): void {
      selectedItemId.value = null
    },
    async createItem(title: string, lane: Lane): Promise<void> {
      const currentHumanId = humanId.value
      const boardId = activeBoardId.value
      const trimmed = title.trim()

      if (currentHumanId === null || boardId === null || trimmed === '') {
        return
      }

      optimisticSequence += 1
      const optimisticId = `optimistic-${optimisticSequence}`
      const optimistic: WorkItemSummary = {
        id: optimisticId,
        boardId,
        title: trimmed,
        lane,
        owner: 'Unassigned',
        description: '',
        labels: [],
        assignees: [],
        priority: 'unset',
        dueDate: null,
        percentDone: 0,
        checklist: [],
        comments: [],
        attachments: [],
        coverColour: null,
        coverImageUrl: null,
        coverAttachmentId: null,
        position: loaded.value.length,
      }

      createError.value = null
      loaded.value = [...loaded.value, optimistic]

      try {
        const created: WorkItemDetail = await gateway.createWorkItem(currentHumanId, {
          boardId,
          title: trimmed,
          lane,
        })
        loaded.value = loaded.value.map((item) =>
          item.id === optimisticId ? created : item,
        )
      } catch (error) {
        loaded.value = loaded.value.filter((item) => item.id !== optimisticId)
        createError.value =
          error instanceof BoardAccessRefused
            ? 'Creating this card was refused.'
            : 'Creating this card failed.'
      }
    },
    async moveItem(itemId: WorkItemId, lane: Lane, position?: number): Promise<void> {
      const currentHumanId = humanId.value
      const current = loaded.value.find((item) => item.id === itemId)

      if (currentHumanId === null || current === undefined || current.lane === lane) {
        return
      }

      const previous = loaded.value
      const originLane = current.lane
      const dest = previous
        .filter((item) => item.lane === lane)
        .slice()
        .sort((left, right) => left.position - right.position)
      const destPosition = Math.max(0, Math.min(position ?? dest.length, dest.length))
      dest.splice(destPosition, 0, { ...current, lane })
      const positionedDest = dest.map((item, index) => ({ ...item, position: index }))
      const origin = previous
        .filter((item) => item.lane === originLane && item.id !== itemId)
        .slice()
        .sort((left, right) => left.position - right.position)
        .map((item, index) => ({ ...item, position: index }))
      const rest = previous.filter(
        (item) => item.lane !== lane && item.lane !== originLane,
      )

      moveError.value = null
      movingItemId.value = itemId
      loaded.value = [...rest, ...origin, ...positionedDest]

      try {
        await gateway.moveItemToLane(currentHumanId, itemId, lane)
        if (position !== undefined) {
          await gateway.reorderWorkItem(currentHumanId, itemId, { lane, position: destPosition })
        }
      } catch (error) {
        loaded.value = previous
        moveError.value =
          error instanceof Error ? error.message : 'The move was refused.'
      } finally {
        movingItemId.value = null
      }
    },
    async reorderItem(itemId: WorkItemId, lane: Lane, position: number): Promise<void> {
      const currentHumanId = humanId.value
      const current = loaded.value.find((item) => item.id === itemId)

      if (currentHumanId === null || current === undefined || current.lane !== lane) {
        return
      }

      const inLane = loaded.value
        .filter((item) => item.lane === lane)
        .slice()
        .sort((left, right) => left.position - right.position)
      const from = inLane.findIndex((item) => item.id === itemId)
      const to = Math.max(0, Math.min(position, inLane.length - 1))

      if (from === -1 || from === to) {
        return
      }

      const previous = loaded.value
      const reordered = inLane.slice()
      const [carried] = reordered.splice(from, 1)

      if (carried === undefined) {
        return
      }

      reordered.splice(to, 0, carried)
      const positioned = reordered.map((item, index) => ({ ...item, position: index }))

      moveError.value = null
      movingItemId.value = itemId
      loaded.value = [
        ...previous.filter((item) => item.lane !== lane),
        ...positioned,
      ]

      try {
        await gateway.reorderWorkItem(currentHumanId, itemId, { lane, position: to })
      } catch (error) {
        loaded.value = previous
        moveError.value =
          error instanceof Error ? error.message : 'The reorder was refused.'
      } finally {
        movingItemId.value = null
      }
    },
  }
}
