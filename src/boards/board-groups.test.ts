import { describe, expect, it } from 'vitest'
import type { VisibleBoard } from '@/domain/workplace'
import { groupBoardsByAgent } from '@/boards/board-groups'

const board = (
  id: string,
  agentId: string,
  agentName: string,
  profession: string | null,
  title: string,
): VisibleBoard => ({
  id,
  agentId,
  agentName,
  profession,
  title,
})

describe('grouping visible boards by their owning agent', () => {
  it('keeps two agents apart when each holds exactly one board', () => {
    const groups = groupBoardsByAgent([
      board('board-one', 'agent-one', 'Agent One', 'Profession One', 'First'),
      board('board-two', 'agent-two', 'Agent Two', null, 'Second'),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.agentName)).toEqual(['Agent One', 'Agent Two'])
    expect(groups.map((group) => group.profession)).toEqual(['Profession One', null])
    expect(groups.map((group) => group.boards.length)).toEqual([1, 1])
  })

  it('keeps two boards of one agent in a single group', () => {
    const groups = groupBoardsByAgent([
      board('board-one', 'agent-one', 'Agent One', 'Profession One', 'First'),
      board('board-two', 'agent-one', 'Agent One', 'Profession One', 'Second'),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.agentId).toBe('agent-one')
    expect(groups[0]?.profession).toBe('Profession One')
    expect(groups[0]?.boards.map((entry) => entry.id)).toEqual(['board-one', 'board-two'])
  })

  it('groups boards of one agent that do not arrive next to each other', () => {
    const groups = groupBoardsByAgent([
      board('board-one', 'agent-one', 'Agent One', 'Profession One', 'First'),
      board('board-two', 'agent-two', 'Agent Two', null, 'Second'),
      board('board-three', 'agent-one', 'Agent One', 'Profession One', 'Third'),
    ])

    expect(groups.map((group) => group.agentId)).toEqual(['agent-one', 'agent-two'])
    expect(groups[0]?.boards.map((entry) => entry.id)).toEqual(['board-one', 'board-three'])
  })

  it('produces no group at all from no boards', () => {
    expect(groupBoardsByAgent([])).toEqual([])
  })

  it('flattens back to exactly the boards it was given, in order', () => {
    const boards = [
      board('board-one', 'agent-one', 'Agent One', 'Profession One', 'First'),
      board('board-two', 'agent-two', 'Agent Two', null, 'Second'),
      board('board-three', 'agent-one', 'Agent One', 'Profession One', 'Third'),
    ]

    const flattened = groupBoardsByAgent(boards).flatMap((group) => group.boards)

    expect(flattened.map((entry) => entry.id).sort()).toEqual(
      boards.map((entry) => entry.id).sort(),
    )
    expect(flattened).toHaveLength(boards.length)
  })
})
