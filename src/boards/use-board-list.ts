import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { BoardId, HumanId, VisibleBoard } from '@/domain/workplace'
import { groupBoardsByAgent, type BoardGroup } from '@/boards/board-groups'
import type { TaskGateway } from '@/gateway/task-gateway'
import { BoardAccessRefused } from '@/gateway/refusals'

/**
 * `loading` and `error` are kept distinct from `ready` with no boards on
 * purpose: a human who may open no boards and a gateway that failed must not
 * render the same way, and an empty board is a board rather than an absence.
 */
export type BoardListStatus = 'loading' | 'ready' | 'error'

/**
 * The two ways selecting a board can fail, kept apart for the same reason
 * `useItemDetail` keeps `refused` apart from `error`: `refused` says this human
 * may not open that board, and `unreadable` says the read failed and claims
 * nothing about permission. Only a thrown `BoardAccessRefused` is the former.
 */
export type BoardSelectionFailure = 'refused' | 'unreadable'

export interface BoardList {
  readonly status: Readonly<Ref<BoardListStatus>>
  readonly boards: ComputedRef<readonly VisibleBoard[]>
  readonly groups: ComputedRef<readonly BoardGroup[]>
  readonly isEmpty: ComputedRef<boolean>
  readonly activeBoard: ComputedRef<VisibleBoard | null>
  readonly selectionFailure: Readonly<Ref<BoardSelectionFailure | null>>
  readonly refusal: Readonly<Ref<string | null>>
  refresh(): Promise<void>
  selectBoard(boardId: BoardId): Promise<void>
}

const REFUSED = 'Kolonie Workplace: that board is not available to this human.'

export function useBoardList(
  gateway: TaskGateway,
  humanId: Readonly<Ref<HumanId | null>>,
): BoardList {
  const status = ref<BoardListStatus>('loading')
  const loaded = ref<readonly VisibleBoard[]>([])
  const active = ref<VisibleBoard | null>(null)
  const selectionFailure = ref<BoardSelectionFailure | null>(null)
  const refusal = ref<string | null>(null)

  async function refresh(): Promise<void> {
    const currentHumanId = humanId.value

    if (currentHumanId === null) {
      status.value = 'ready'
      loaded.value = []
      active.value = null
      return
    }

    status.value = 'loading'

    try {
      loaded.value = await gateway.listVisibleBoards(currentHumanId)
      status.value = 'ready'
    } catch {
      loaded.value = []
      active.value = null
      status.value = 'error'
    }
  }

  /**
   * A selection that fails leaves no board active. Holding the previous board
   * would put its header, its cards and its rows underneath a message saying
   * the selection failed — content belonging to a board the human did not just
   * choose, under an alert about one they did. Clearing happens at the start of
   * the attempt rather than in the failure branch, so a selection in flight
   * cannot show one board's content while another is being read.
   */
  async function selectBoard(boardId: BoardId): Promise<void> {
    const currentHumanId = humanId.value

    if (currentHumanId === null) {
      return
    }

    active.value = null
    selectionFailure.value = null
    refusal.value = null

    try {
      await gateway.getBoardItems(currentHumanId, boardId)
    } catch (error: unknown) {
      selectionFailure.value =
        error instanceof BoardAccessRefused ? 'refused' : 'unreadable'
      refusal.value = selectionFailure.value === 'refused' ? REFUSED : null
      return
    }

    const board = loaded.value.find((candidate) => candidate.id === boardId)

    if (board === undefined) {
      selectionFailure.value = 'refused'
      refusal.value = REFUSED
      return
    }

    active.value = board
  }

  watch(
    humanId,
    () => {
      active.value = null
      selectionFailure.value = null
      refusal.value = null
      void refresh()
    },
    { immediate: true },
  )

  return {
    status,
    boards: computed(() => loaded.value),
    groups: computed(() => groupBoardsByAgent(loaded.value)),
    isEmpty: computed(() => status.value === 'ready' && loaded.value.length === 0),
    activeBoard: computed(() => active.value),
    selectionFailure,
    refusal,
    refresh,
    selectBoard,
  }
}
