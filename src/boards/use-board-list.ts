import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { BoardId, HumanId, VisibleBoard } from '@/domain/workplace'
import { groupBoardsByAgent, type BoardGroup } from '@/boards/board-groups'
import type { TaskGateway } from '@/gateway/task-gateway'

/**
 * `loading` and `error` are kept distinct from `ready` with no boards on
 * purpose: a human who may open no boards and a gateway that failed must not
 * render the same way, and an empty board is a board rather than an absence.
 */
export type BoardListStatus = 'loading' | 'ready' | 'error'

export interface BoardList {
  readonly status: Readonly<Ref<BoardListStatus>>
  readonly boards: ComputedRef<readonly VisibleBoard[]>
  readonly groups: ComputedRef<readonly BoardGroup[]>
  readonly isEmpty: ComputedRef<boolean>
  readonly activeBoard: ComputedRef<VisibleBoard | null>
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

  async function selectBoard(boardId: BoardId): Promise<void> {
    const currentHumanId = humanId.value

    if (currentHumanId === null) {
      return
    }

    try {
      await gateway.getBoardItems(currentHumanId, boardId)
    } catch {
      refusal.value = REFUSED
      return
    }

    const board = loaded.value.find((candidate) => candidate.id === boardId)

    if (board === undefined) {
      refusal.value = REFUSED
      return
    }

    refusal.value = null
    active.value = board
  }

  watch(
    humanId,
    () => {
      active.value = null
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
    refusal,
    refresh,
    selectBoard,
  }
}
