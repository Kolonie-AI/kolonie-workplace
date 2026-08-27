import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { HumanId, VisibleBoard } from '@/domain/workplace'
import { BoardAccessRefused } from '@/gateway/refusals'
import type { TaskGateway } from '@/gateway/task-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS } from '@/fixtures/catalogue'
import { useBoardList } from '@/boards/use-board-list'

function fixtureList(humanId: HumanId | null, gateway: TaskGateway = createFixtureTaskGateway()) {
  return useBoardList(gateway, ref(humanId))
}

async function settled(humanId: HumanId | null, gateway?: TaskGateway) {
  const list = fixtureList(humanId, gateway)
  await list.refresh()
  return list
}

describe('useBoardList — reading the visible boards', () => {
  it('starts in the loading state and asks the gateway for this human', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'listVisibleBoards')
    const list = fixtureList(FIXTURE_HUMANS.wren, gateway)

    expect(list.status.value).toBe('loading')

    await list.refresh()

    expect(spy).toHaveBeenCalledWith(FIXTURE_HUMANS.wren)
    expect(list.status.value).toBe('ready')
  })

  it('journey 1: two agents with one board each produce two attributed boards', async () => {
    const list = await settled(FIXTURE_HUMANS.wren)

    expect(list.boards.value.map((board) => board.id).sort()).toEqual(
      [FIXTURE_BOARDS.quillDelivery, FIXTURE_BOARDS.birchResearch].sort(),
    )
    expect(list.groups.value).toHaveLength(2)
    expect(list.groups.value.every((group) => group.agentName.length > 0)).toBe(true)
  })

  it('journey 2: one agent with two boards produces one group of two', async () => {
    const list = await settled(FIXTURE_HUMANS.ash)

    expect(list.groups.value).toHaveLength(1)
    expect(list.groups.value[0]?.boards.map((board) => board.id).sort()).toEqual(
      [FIXTURE_BOARDS.marlowOutreach, FIXTURE_BOARDS.marlowBacklog].sort(),
    )
  })

  it('journey 3: a human with no agents is ready with no boards, and is not an error', async () => {
    const list = await settled(FIXTURE_HUMANS.rook)

    expect(list.status.value).toBe('ready')
    expect(list.boards.value).toEqual([])
    expect(list.groups.value).toEqual([])
    expect(list.isEmpty.value).toBe(true)
  })

  it('journey 4: a foreign board is absent from the visible list', async () => {
    const list = await settled(FIXTURE_HUMANS.wren)

    expect(list.boards.value.map((board) => board.id)).not.toContain(
      FIXTURE_BOARDS.marlowOutreach,
    )
  })

  it('journey 5: a board with no items is listed exactly like any other board', async () => {
    const list = await settled(FIXTURE_HUMANS.ash)

    expect(list.boards.value.map((board) => board.id)).toContain(FIXTURE_BOARDS.marlowBacklog)
    expect(list.isEmpty.value).toBe(false)
  })

  it('separates journey 3 from journey 5: no boards is not the same state as an empty board', async () => {
    const noBoards = await settled(FIXTURE_HUMANS.rook)
    const emptyBoard = await settled(FIXTURE_HUMANS.ash)

    expect(noBoards.isEmpty.value).toBe(true)
    expect(emptyBoard.isEmpty.value).toBe(false)

    await emptyBoard.selectBoard(FIXTURE_BOARDS.marlowBacklog)

    expect(emptyBoard.activeBoard.value?.id).toBe(FIXTURE_BOARDS.marlowBacklog)
    expect(emptyBoard.isEmpty.value).toBe(false)
    expect(noBoards.activeBoard.value).toBeNull()
  })

  it('asks for nothing at all while no human is signed in', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(),
      getBoardItems: vi.fn(),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
    }

    await settled(null, gateway)

    expect(gateway.listVisibleBoards).not.toHaveBeenCalled()
  })
})

describe('useBoardList — failure is not emptiness', () => {
  it('enters the error state when the gateway fails, and lists no board', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => {
        throw new Error('Kolonie Workplace: the board catalogue could not be read.')
      }),
      getBoardItems: vi.fn(),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
    }

    const list = await settled(FIXTURE_HUMANS.wren, gateway)

    expect(list.status.value).toBe('error')
    expect(list.boards.value).toEqual([])
    expect(list.isEmpty.value).toBe(false)
  })
})

describe('useBoardList — selecting a board', () => {
  it('makes the chosen board active', async () => {
    const list = await settled(FIXTURE_HUMANS.wren)

    await list.selectBoard(FIXTURE_BOARDS.birchResearch)

    expect(list.activeBoard.value?.id).toBe(FIXTURE_BOARDS.birchResearch)
    expect(list.refusal.value).toBeNull()
  })

  it('rejection case: a foreign board addressed directly is refused, not opened', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getBoardItems')
    const list = await settled(FIXTURE_HUMANS.wren, gateway)

    await list.selectBoard(FIXTURE_BOARDS.marlowOutreach)

    expect(spy).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.marlowOutreach)
    expect(list.activeBoard.value).toBeNull()
    expect(list.refusal.value).toMatch(/not available/i)
  })

  it('refuses a board id nobody holds in exactly the same way', async () => {
    const list = await settled(FIXTURE_HUMANS.wren)

    await list.selectBoard('fictional-board-nobody-holds')

    expect(list.activeBoard.value).toBeNull()
    expect(list.refusal.value).toMatch(/not available/i)
  })

  it('rejection case: a refused selection clears the board that was active', async () => {
    const list = await settled(FIXTURE_HUMANS.wren)

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)
    expect(list.activeBoard.value?.id).toBe(FIXTURE_BOARDS.quillDelivery)

    await list.selectBoard(FIXTURE_BOARDS.marlowOutreach)

    expect(list.activeBoard.value).toBeNull()
    expect(list.selectionFailure.value).toBe('refused')
    expect(list.refusal.value).toMatch(/not available/i)
  })

  it('clears an earlier refusal once a board the human may open is selected', async () => {
    const list = await settled(FIXTURE_HUMANS.wren)

    await list.selectBoard(FIXTURE_BOARDS.marlowOutreach)
    expect(list.refusal.value).not.toBeNull()

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)

    expect(list.refusal.value).toBeNull()
    expect(list.activeBoard.value?.id).toBe(FIXTURE_BOARDS.quillDelivery)
  })

  it('refuses by asking the gateway, not by consulting the list it already holds', async () => {
    const smuggled: VisibleBoard = {
      id: FIXTURE_BOARDS.marlowOutreach,
      agentId: 'fictional-agent-marlow',
      agentName: 'Fictional Agent Marlow',
      profession: null,
      title: 'Fictional Marlow Outreach',
    }
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [smuggled]),
      getBoardItems: vi.fn(async () => {
        throw new BoardAccessRefused(FIXTURE_BOARDS.marlowOutreach)
      }),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
    }

    const list = await settled(FIXTURE_HUMANS.wren, gateway)

    await list.selectBoard(FIXTURE_BOARDS.marlowOutreach)

    expect(gateway.getBoardItems).toHaveBeenCalledWith(
      FIXTURE_HUMANS.wren,
      FIXTURE_BOARDS.marlowOutreach,
    )
    expect(list.activeBoard.value).toBeNull()
    expect(list.refusal.value).toMatch(/not available/i)
  })

  it('names no foreign board title in the refusal it reports', async () => {
    const list = await settled(FIXTURE_HUMANS.wren)

    await list.selectBoard(FIXTURE_BOARDS.marlowOutreach)

    expect(list.refusal.value).not.toMatch(/outreach/i)
  })

  it('selects nothing while no human is signed in', async () => {
    const list = await settled(null)

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)

    expect(list.activeBoard.value).toBeNull()
  })
})

describe('useBoardList — a read failure is not a permission refusal', () => {
  function gatewayFailingSelectionWith(error: Error): TaskGateway {
    return {
      listVisibleBoards: vi.fn(async () => [
        {
          id: FIXTURE_BOARDS.quillDelivery,
          agentId: 'fictional-agent-quill',
          agentName: 'Fictional Agent Quill',
          profession: null,
          title: 'Fictional Quill Delivery',
        },
      ]),
      getBoardItems: vi.fn(async () => {
        throw error
      }),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
    }
  }

  it('rejection case: a plain read failure makes no claim about permission', async () => {
    const list = await settled(
      FIXTURE_HUMANS.wren,
      gatewayFailingSelectionWith(
        new Error('Kolonie Workplace: the board items could not be read.'),
      ),
    )

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)

    expect(list.selectionFailure.value).toBe('unreadable')
    expect(list.refusal.value).toBeNull()
    expect(list.activeBoard.value).toBeNull()
  })

  it('keeps a thrown BoardAccessRefused as the refusal it already was', async () => {
    const list = await settled(
      FIXTURE_HUMANS.wren,
      gatewayFailingSelectionWith(new BoardAccessRefused(FIXTURE_BOARDS.quillDelivery)),
    )

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)

    expect(list.selectionFailure.value).toBe('refused')
    expect(list.refusal.value).toMatch(/not available/i)
    expect(list.activeBoard.value).toBeNull()
  })

  it('distinguishes the two rather than reporting one state for both', async () => {
    const refused = await settled(
      FIXTURE_HUMANS.wren,
      gatewayFailingSelectionWith(new BoardAccessRefused(FIXTURE_BOARDS.quillDelivery)),
    )
    const unreadable = await settled(
      FIXTURE_HUMANS.wren,
      gatewayFailingSelectionWith(new Error('Kolonie Workplace: the read failed.')),
    )

    await refused.selectBoard(FIXTURE_BOARDS.quillDelivery)
    await unreadable.selectBoard(FIXTURE_BOARDS.quillDelivery)

    expect(refused.selectionFailure.value).not.toBe(unreadable.selectionFailure.value)
    expect(unreadable.refusal.value).toBeNull()
    expect(refused.refusal.value).not.toBeNull()
  })

  it('shows no stale board content after a read failure', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: FIXTURE_BOARDS.quillDelivery,
          agentId: 'fictional-agent-quill',
          agentName: 'Fictional Agent Quill',
          profession: null,
          title: 'Fictional Quill Delivery',
        },
        {
          id: FIXTURE_BOARDS.birchResearch,
          agentId: 'fictional-agent-birch',
          agentName: 'Fictional Agent Birch',
          profession: null,
          title: 'Fictional Birch Research',
        },
      ]),
      getBoardItems: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockRejectedValue(new Error('Kolonie Workplace: the board items could not be read.')),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
    }

    const list = await settled(FIXTURE_HUMANS.wren, gateway)

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)
    expect(list.activeBoard.value?.id).toBe(FIXTURE_BOARDS.quillDelivery)

    await list.selectBoard(FIXTURE_BOARDS.birchResearch)

    expect(list.selectionFailure.value).toBe('unreadable')
    expect(list.activeBoard.value).toBeNull()
  })

  it('clears an earlier read failure once a board reads successfully', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: FIXTURE_BOARDS.quillDelivery,
          agentId: 'fictional-agent-quill',
          agentName: 'Fictional Agent Quill',
          profession: null,
          title: 'Fictional Quill Delivery',
        },
      ]),
      getBoardItems: vi
        .fn()
        .mockRejectedValueOnce(new Error('Kolonie Workplace: the read failed.'))
        .mockResolvedValue([]),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
    }

    const list = await settled(FIXTURE_HUMANS.wren, gateway)

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)
    expect(list.selectionFailure.value).toBe('unreadable')

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)

    expect(list.selectionFailure.value).toBeNull()
    expect(list.refusal.value).toBeNull()
    expect(list.activeBoard.value?.id).toBe(FIXTURE_BOARDS.quillDelivery)
  })

  it('reports a board the list does not hold as a refusal, unchanged', async () => {
    const list = await settled(FIXTURE_HUMANS.wren)

    await list.selectBoard('fictional-board-nobody-holds')

    expect(list.selectionFailure.value).toBe('refused')
    expect(list.refusal.value).toMatch(/not available/i)
  })
})

describe('useBoardList — a failed selection leaves no board active', () => {
  function twoBoards(secondCall: Error): TaskGateway {
    return {
      listVisibleBoards: vi.fn(async () => [
        {
          id: FIXTURE_BOARDS.quillDelivery,
          agentId: 'fictional-agent-quill',
          agentName: 'Fictional Agent Quill',
          profession: null,
          title: 'Fictional Quill Delivery',
        },
        {
          id: FIXTURE_BOARDS.birchResearch,
          agentId: 'fictional-agent-birch',
          agentName: 'Fictional Agent Birch',
          profession: null,
          title: 'Fictional Birch Research',
        },
      ]),
      getBoardItems: vi.fn().mockResolvedValueOnce([]).mockRejectedValue(secondCall),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
    }
  }

  it('rejection case: a refusal after a successful board clears the active one', async () => {
    const list = await settled(
      FIXTURE_HUMANS.wren,
      twoBoards(new BoardAccessRefused(FIXTURE_BOARDS.birchResearch)),
    )

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)
    expect(list.activeBoard.value?.id).toBe(FIXTURE_BOARDS.quillDelivery)

    await list.selectBoard(FIXTURE_BOARDS.birchResearch)

    expect(list.activeBoard.value).toBeNull()
    expect(list.selectionFailure.value).toBe('refused')
    expect(list.refusal.value).toMatch(/not available/i)
  })

  it('rejection case: a plain read failure after a successful board clears it too', async () => {
    const list = await settled(
      FIXTURE_HUMANS.wren,
      twoBoards(new Error('Kolonie Workplace: the board items could not be read.')),
    )

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)
    expect(list.activeBoard.value?.id).toBe(FIXTURE_BOARDS.quillDelivery)

    await list.selectBoard(FIXTURE_BOARDS.birchResearch)

    expect(list.activeBoard.value).toBeNull()
    expect(list.selectionFailure.value).toBe('unreadable')
    expect(list.refusal.value).toBeNull()
  })

  it('recovers fully when a later selection succeeds after a refusal', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: FIXTURE_BOARDS.quillDelivery,
          agentId: 'fictional-agent-quill',
          agentName: 'Fictional Agent Quill',
          profession: null,
          title: 'Fictional Quill Delivery',
        },
        {
          id: FIXTURE_BOARDS.birchResearch,
          agentId: 'fictional-agent-birch',
          agentName: 'Fictional Agent Birch',
          profession: null,
          title: 'Fictional Birch Research',
        },
      ]),
      getBoardItems: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new BoardAccessRefused(FIXTURE_BOARDS.birchResearch))
        .mockResolvedValue([]),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
    }

    const list = await settled(FIXTURE_HUMANS.wren, gateway)

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)
    await list.selectBoard(FIXTURE_BOARDS.birchResearch)
    expect(list.activeBoard.value).toBeNull()

    await list.selectBoard(FIXTURE_BOARDS.birchResearch)

    expect(list.activeBoard.value?.id).toBe(FIXTURE_BOARDS.birchResearch)
    expect(list.selectionFailure.value).toBeNull()
    expect(list.refusal.value).toBeNull()
  })

  it('recovers fully when a later selection succeeds after a read failure', async () => {
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => [
        {
          id: FIXTURE_BOARDS.quillDelivery,
          agentId: 'fictional-agent-quill',
          agentName: 'Fictional Agent Quill',
          profession: null,
          title: 'Fictional Quill Delivery',
        },
        {
          id: FIXTURE_BOARDS.birchResearch,
          agentId: 'fictional-agent-birch',
          agentName: 'Fictional Agent Birch',
          profession: null,
          title: 'Fictional Birch Research',
        },
      ]),
      getBoardItems: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Kolonie Workplace: the read failed.'))
        .mockResolvedValue([]),
      getItemDetail: vi.fn(),
      moveItemToLane: vi.fn(),
      createWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      reorderWorkItem: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      createChecklistItem: vi.fn(),
      updateChecklistItem: vi.fn(),
      reorderChecklistItem: vi.fn(),
      deleteChecklistItem: vi.fn(),
    }

    const list = await settled(FIXTURE_HUMANS.wren, gateway)

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)
    await list.selectBoard(FIXTURE_BOARDS.birchResearch)
    expect(list.activeBoard.value).toBeNull()

    await list.selectBoard(FIXTURE_BOARDS.quillDelivery)

    expect(list.activeBoard.value?.id).toBe(FIXTURE_BOARDS.quillDelivery)
    expect(list.selectionFailure.value).toBeNull()
    expect(list.refusal.value).toBeNull()
  })
})
