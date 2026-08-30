import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { BoardId, WorkItemSummary } from '@/domain/workplace'
import { WorkItemAccessRefused } from '@/gateway/refusals'
import { WorkplaceConflict } from '@/gateway/workplace-http-errors'
import type { TaskGateway } from '@/gateway/task-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS, FIXTURE_ITEMS } from '@/fixtures/catalogue'
import { useBoardItems } from '@/items/use-board-items'

/**
 * The move is workplace-local and provisional. These tests pin the four things
 * the surface promises: the lane changes, a move onto the item's own lane asks
 * the gateway for nothing, a refusal puts the card back, and the two
 * presentations of the loaded state never disagree about where an item is.
 */
async function settled(): Promise<void> {
  await nextTick()
  await nextTick()
  await nextTick()
}

function laneOf(
  items: ReturnType<typeof useBoardItems>,
  itemId: string,
): string | undefined {
  return items.columns.value.find((column) =>
    column.items.some((item) => item.id === itemId),
  )?.lane
}

function boardItems(gateway: TaskGateway) {
  return useBoardItems(
    gateway,
    ref(FIXTURE_HUMANS.wren),
    ref<BoardId | null>(FIXTURE_BOARDS.quillDelivery),
  )
}

describe('lane move — the item lands in the target lane', () => {
  it('moves the item and asks the gateway to record it once', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'moveItemToLane')
    const items = boardItems(gateway)
    await settled()

    expect(laneOf(items, FIXTURE_ITEMS.ready)).toBe('ready')

    await items.moveItem(FIXTURE_ITEMS.ready, 'in_progress')
    await settled()

    expect(laneOf(items, FIXTURE_ITEMS.ready)).toBe('in_progress')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      'in_progress',
    )
    expect(items.moveError.value).toBeNull()
  })

  it('shows the move in the list rows as well as the lane columns', async () => {
    const items = boardItems(createFixtureTaskGateway())
    await settled()

    await items.moveItem(FIXTURE_ITEMS.ready, 'done')
    await settled()

    const row = items.rows.value.find((entry) => entry.item.id === FIXTURE_ITEMS.ready)

    expect(row?.lane).toBe('done')
    expect(laneOf(items, FIXTURE_ITEMS.ready)).toBe('done')
  })

  it('keeps the move for the session, so a re-read of the board still shows it', async () => {
    const gateway = createFixtureTaskGateway()
    const activeBoardId = ref<BoardId | null>(FIXTURE_BOARDS.quillDelivery)
    const items = useBoardItems(gateway, ref(FIXTURE_HUMANS.wren), activeBoardId)
    await settled()

    await items.moveItem(FIXTURE_ITEMS.ready, 'review')
    await settled()

    activeBoardId.value = FIXTURE_BOARDS.birchResearch
    await settled()
    activeBoardId.value = FIXTURE_BOARDS.quillDelivery
    await settled()

    expect(laneOf(items, FIXTURE_ITEMS.ready)).toBe('review')
  })
})

describe('lane move — a move onto its own lane is a no-op', () => {
  it('does not call the gateway at all', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'moveItemToLane')
    const items = boardItems(gateway)
    await settled()

    await items.moveItem(FIXTURE_ITEMS.ready, 'ready')
    await settled()

    expect(spy).not.toHaveBeenCalled()
    expect(laneOf(items, FIXTURE_ITEMS.ready)).toBe('ready')
    expect(items.moveError.value).toBeNull()
  })
})

describe('lane move — rejection: the gateway refuses', () => {
  function refusingGateway(): TaskGateway {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'moveItemToLane').mockRejectedValue(
      new WorkItemAccessRefused(FIXTURE_ITEMS.ready),
    )
    return gateway
  }

  it('returns the card to its original lane and reports the refusal', async () => {
    const items = boardItems(refusingGateway())
    await settled()

    await items.moveItem(FIXTURE_ITEMS.ready, 'done')
    await settled()

    expect(laneOf(items, FIXTURE_ITEMS.ready)).toBe('ready')
    expect(items.moveError.value).toMatch(/not available to this human/i)
    expect(items.movingItemId.value).toBeNull()
  })

  it('keeps every other item where it was when one move is refused', async () => {
    const items = boardItems(refusingGateway())
    await settled()

    const before = items.rows.value.map((row) => `${row.item.id}:${row.lane}`)

    await items.moveItem(FIXTURE_ITEMS.ready, 'done')
    await settled()

    expect(items.rows.value.map((row) => `${row.item.id}:${row.lane}`)).toEqual(before)
  })

  it('uses one positioned move write rather than moving and then reordering', async () => {
    const gateway = createFixtureTaskGateway()
    const move = vi.spyOn(gateway, 'moveItemToLane')
    const reorder = vi.spyOn(gateway, 'reorderWorkItem')
    const items = boardItems(gateway)
    await settled()

    await items.moveItem(FIXTURE_ITEMS.ready, 'in_progress', 0)
    await settled()

    expect(move).toHaveBeenCalledTimes(1)
    expect(move).toHaveBeenCalledWith(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      'in_progress',
      0,
    )
    expect(reorder).not.toHaveBeenCalled()
  })

  it('reloads the canonical board after a conflict instead of restoring the old lane', async () => {
    const gateway = createFixtureTaskGateway()
    const originalRead = gateway.getBoardItems.bind(gateway)
    let reads = 0
    vi.spyOn(gateway, 'getBoardItems').mockImplementation(async (humanId, boardId) => {
      reads += 1
      const current = await originalRead(humanId, boardId)
      if (reads === 1) {
        return current
      }

      return current.map((item) =>
        item.id === FIXTURE_ITEMS.ready ? { ...item, lane: 'blocked' as const } : item,
      )
    })
    vi.spyOn(gateway, 'moveItemToLane').mockRejectedValue(new WorkplaceConflict())
    const items = boardItems(gateway)
    await settled()

    await items.moveItem(FIXTURE_ITEMS.ready, 'in_progress')
    await settled()

    expect(laneOf(items, FIXTURE_ITEMS.ready)).toBe('blocked')
    expect(gateway.getBoardItems).toHaveBeenCalledTimes(2)
    expect(items.moveError.value).toMatch(/changed|canonical/i)
  })
})

describe('lane move — the move never leaves the session', () => {
  it('writes nothing to browser storage', async () => {
    const touched: string[] = []
    const watch = (label: string, storage: Storage) =>
      new Proxy(storage, {
        get(target, property, receiver) {
          touched.push(`${label}.${String(property)}`)
          return Reflect.get(target, property, receiver) as unknown
        },
      })

    const originalLocal = globalThis.localStorage
    const originalSession = globalThis.sessionStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: watch('localStorage', originalLocal),
      configurable: true,
    })
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: watch('sessionStorage', originalSession),
      configurable: true,
    })

    try {
      const items = boardItems(createFixtureTaskGateway())
      await settled()
      await items.moveItem(FIXTURE_ITEMS.ready, 'done')
      await settled()
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocal,
        configurable: true,
      })
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSession,
        configurable: true,
      })
    }

    expect(touched).toEqual([])
  })

  it('leaves a second gateway instance on the fixture lanes', async () => {
    const first = createFixtureTaskGateway()
    const items = boardItems(first)
    await settled()

    await items.moveItem(FIXTURE_ITEMS.ready, 'done')
    await settled()

    const fresh = await createFixtureTaskGateway().getBoardItems(
      FIXTURE_HUMANS.wren,
      FIXTURE_BOARDS.quillDelivery,
    )
    const moved = fresh.find(
      (item: WorkItemSummary) => item.id === FIXTURE_ITEMS.ready,
    )

    expect(moved?.lane).toBe('ready')
  })
})

function idsInLane(items: ReturnType<typeof useBoardItems>, lane: string): string[] {
  return items.columns.value.find((column) => column.lane === lane)?.items.map((item) => item.id) ?? []
}

describe('lane reorder — within-list order persists', () => {
  it('asks the gateway to reorder and keeps the new order after a re-read', async () => {
    const gateway = createFixtureTaskGateway()
    await gateway.createWorkItem(FIXTURE_HUMANS.wren, {
      boardId: FIXTURE_BOARDS.quillDelivery,
      title: 'Second fictional ready card',
      lane: 'ready',
    })
    const spy = vi.spyOn(gateway, 'reorderWorkItem')
    const activeBoardId = ref<BoardId | null>(FIXTURE_BOARDS.quillDelivery)
    const items = useBoardItems(gateway, ref(FIXTURE_HUMANS.wren), activeBoardId)
    await settled()

    const before = idsInLane(items, 'ready')
    expect(before).toHaveLength(2)
    const first = before[0]
    const second = before[1]
    if (first === undefined || second === undefined) {
      throw new Error('Kolonie Workplace: expected two ready cards.')
    }

    await items.reorderItem(first, 'ready', 1)
    await settled()

    expect(idsInLane(items, 'ready')).toEqual([second, first])
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, first, {
      lane: 'ready',
      position: 1,
    })

    activeBoardId.value = FIXTURE_BOARDS.birchResearch
    await settled()
    activeBoardId.value = FIXTURE_BOARDS.quillDelivery
    await settled()

    expect(idsInLane(items, 'ready')).toEqual([second, first])
  })

  it('does not call the gateway when the card is already at that position', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'reorderWorkItem')
    const items = boardItems(gateway)
    await settled()

    await items.reorderItem(FIXTURE_ITEMS.ready, 'ready', 0)
    await settled()

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('lane reorder — rejection: the gateway refuses', () => {
  it('restores the previous order and reports the refusal', async () => {
    const gateway = createFixtureTaskGateway()
    await gateway.createWorkItem(FIXTURE_HUMANS.wren, {
      boardId: FIXTURE_BOARDS.quillDelivery,
      title: 'Second fictional ready card',
      lane: 'ready',
    })
    vi.spyOn(gateway, 'reorderWorkItem').mockRejectedValue(
      new WorkItemAccessRefused(FIXTURE_ITEMS.ready),
    )
    const items = boardItems(gateway)
    await settled()

    const before = idsInLane(items, 'ready')
    const first = before[0]
    if (first === undefined) {
      throw new Error('Kolonie Workplace: expected a ready card.')
    }

    await items.reorderItem(first, 'ready', 1)
    await settled()

    expect(idsInLane(items, 'ready')).toEqual(before)
    expect(items.moveError.value).toMatch(/not available to this human/i)
    expect(items.movingItemId.value).toBeNull()
  })
})
