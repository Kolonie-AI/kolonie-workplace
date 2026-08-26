import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { WORKPLACE_LANES } from '@/domain/lanes'
import type { BoardId, WorkItemSummary } from '@/domain/workplace'
import { BoardAccessRefused } from '@/gateway/refusals'
import type { TaskGateway } from '@/gateway/task-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS, FIXTURE_ITEMS } from '@/fixtures/catalogue'
import { useBoardKanban } from '@/kanban/use-board-kanban'

function summary(overrides: Partial<WorkItemSummary> & { id: string; boardId: string }) {
  return {
    title: `Title for ${overrides.id}`,
    lane: 'ready',
    owner: 'Fictional Owner',
    ...overrides,
  } as WorkItemSummary
}

function gatewayReturning(
  itemsByBoard: Readonly<Record<string, readonly WorkItemSummary[]>>,
): TaskGateway {
  return {
    listVisibleBoards: vi.fn(async () => []),
    getBoardItems: vi.fn(async (_humanId: string, boardId: BoardId) => {
      const items = itemsByBoard[boardId]

      if (items === undefined) {
        throw new BoardAccessRefused(boardId)
      }

      return items
    }),
    getItemDetail: vi.fn(),
  }
}

async function settled(): Promise<void> {
  await nextTick()
  await nextTick()
  await nextTick()
}

describe('board kanban — loading the active board', () => {
  it('reads the active board through the gateway the sidebar already uses', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getBoardItems')
    const kanban = useBoardKanban(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )

    await settled()

    expect(spy).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    expect(kanban.status.value).toBe('ready')
  })

  it('always exposes the six Colony lanes, in order, even before anything loads', () => {
    const kanban = useBoardKanban(
      gatewayReturning({}),
      ref(FIXTURE_HUMANS.wren),
      ref(null),
    )

    expect(kanban.columns.value.map((column) => column.lane)).toEqual([...WORKPLACE_LANES])
  })

  it('asks for nothing while no board is active, and holds no items', async () => {
    const gateway = gatewayReturning({})
    const kanban = useBoardKanban(gateway, ref(FIXTURE_HUMANS.wren), ref(null))

    await settled()

    expect(gateway.getBoardItems).not.toHaveBeenCalled()
    expect(kanban.columns.value.flatMap((column) => column.items)).toEqual([])
  })

  it('distinguishes an empty board from a gateway failure', async () => {
    const empty = useBoardKanban(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.ash),
      ref(FIXTURE_BOARDS.marlowBacklog),
    )
    await settled()

    expect(empty.status.value).toBe('ready')
    expect(empty.isBoardEmpty.value).toBe(true)

    const broken = useBoardKanban(
      {
        listVisibleBoards: vi.fn(async () => []),
        getBoardItems: vi.fn(async () => {
          throw new Error('Kolonie Workplace: the board items could not be read.')
        }),
        getItemDetail: vi.fn(),
      },
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    expect(broken.status.value).toBe('error')
    expect(broken.isBoardEmpty.value).toBe(false)
  })
})

describe('board kanban — one board never shows another board\'s items', () => {
  it('replaces the previous board\'s items rather than accumulating them', async () => {
    const first = 'board-first'
    const second = 'board-second'
    const gateway = gatewayReturning({
      [first]: [summary({ id: 'first-item', boardId: first, lane: 'ready' })],
      [second]: [summary({ id: 'second-item', boardId: second, lane: 'ready' })],
    })
    const activeBoardId = ref<BoardId | null>(first)
    const kanban = useBoardKanban(gateway, ref(FIXTURE_HUMANS.wren), activeBoardId)

    await settled()
    expect(kanban.columns.value.flatMap((c) => c.items.map((i) => i.id))).toEqual([
      'first-item',
    ])

    activeBoardId.value = second
    await settled()

    const rendered = kanban.columns.value.flatMap((c) => c.items.map((i) => i.id))
    expect(rendered).toEqual(['second-item'])
    expect(rendered).not.toContain('first-item')
  })

  it('discards an item the gateway attributes to a different board', async () => {
    const gateway = gatewayReturning({
      'board-first': [
        summary({ id: 'belongs-here', boardId: 'board-first' }),
        summary({ id: 'belongs-elsewhere', boardId: 'board-second' }),
      ],
    })
    const kanban = useBoardKanban(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref<BoardId | null>('board-first'),
    )

    await settled()

    const rendered = kanban.columns.value.flatMap((c) => c.items.map((i) => i.id))
    expect(rendered).toEqual(['belongs-here'])
    expect(rendered).not.toContain('belongs-elsewhere')
    expect(kanban.foreign.value.map((entry) => entry.id)).toEqual(['belongs-elsewhere'])
  })

  it('shows nothing from a board that is no longer active while the next one loads', async () => {
    const activeBoardId = ref<BoardId | null>(FIXTURE_BOARDS.quillDelivery)
    const kanban = useBoardKanban(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      activeBoardId,
    )

    await settled()
    expect(kanban.columns.value.flatMap((c) => c.items).length).toBe(
      WORKPLACE_LANES.length,
    )

    activeBoardId.value = FIXTURE_BOARDS.birchResearch
    await settled()

    expect(kanban.columns.value.flatMap((c) => c.items)).toEqual([])
    expect(kanban.isBoardEmpty.value).toBe(true)
  })
})

describe('board kanban — rejection: an item in a lane the Colony does not define', () => {
  it('surfaces it as invalid data instead of dropping it into inbox', async () => {
    const gateway = gatewayReturning({
      'board-first': [
        { ...summary({ id: 'stray', boardId: 'board-first' }), lane: 'archived' } as unknown as WorkItemSummary,
        summary({ id: 'sound', boardId: 'board-first', lane: 'ready' }),
      ],
    })
    const kanban = useBoardKanban(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref<BoardId | null>('board-first'),
    )

    await settled()

    const inbox = kanban.columns.value.find((column) => column.lane === 'inbox')
    expect(inbox?.items).toEqual([])
    expect(kanban.invalid.value.map((entry) => entry.item.id)).toEqual(['stray'])
    expect(kanban.invalid.value[0]?.reportedLane).toBe('archived')
    expect(kanban.columns.value.flatMap((c) => c.items.map((i) => i.id))).toEqual(['sound'])
  })

  it('does not call a board with only invalid items empty', async () => {
    const gateway = gatewayReturning({
      'board-first': [
        { ...summary({ id: 'stray', boardId: 'board-first' }), lane: 'archived' } as unknown as WorkItemSummary,
      ],
    })
    const kanban = useBoardKanban(
      gateway,
      ref(FIXTURE_HUMANS.wren),
      ref<BoardId | null>('board-first'),
    )

    await settled()

    expect(kanban.isBoardEmpty.value).toBe(false)
    expect(kanban.invalid.value).toHaveLength(1)
  })
})

describe('board kanban — selection', () => {
  it('holds no selection until a card is chosen', async () => {
    const kanban = useBoardKanban(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    expect(kanban.selectedItemId.value).toBeNull()
  })

  it('records the chosen item and replaces an earlier choice', async () => {
    const kanban = useBoardKanban(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      ref(FIXTURE_BOARDS.quillDelivery),
    )
    await settled()

    kanban.selectItem(FIXTURE_ITEMS.ready)
    expect(kanban.selectedItemId.value).toBe(FIXTURE_ITEMS.ready)

    kanban.selectItem(FIXTURE_ITEMS.done)
    expect(kanban.selectedItemId.value).toBe(FIXTURE_ITEMS.done)
  })

  it('clears the selection when the active board changes', async () => {
    const activeBoardId = ref<BoardId | null>(FIXTURE_BOARDS.quillDelivery)
    const kanban = useBoardKanban(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      activeBoardId,
    )
    await settled()

    kanban.selectItem(FIXTURE_ITEMS.ready)
    expect(kanban.selectedItemId.value).toBe(FIXTURE_ITEMS.ready)

    activeBoardId.value = FIXTURE_BOARDS.birchResearch
    await settled()

    expect(kanban.selectedItemId.value).toBeNull()
  })
})
