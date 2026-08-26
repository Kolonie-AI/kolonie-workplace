import { describe, expect, it } from 'vitest'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_AGENTS, FIXTURE_BOARDS, FIXTURE_HUMANS } from '@/fixtures/catalogue'

describe('visible boards — the union a human may open', () => {
  it('shows two boards to a human operating two agents with one board each', async () => {
    const gateway = createFixtureTaskGateway()

    const boards = await gateway.listVisibleBoards(FIXTURE_HUMANS.wren)

    expect(boards.map((board) => board.id).sort()).toEqual(
      [FIXTURE_BOARDS.quillDelivery, FIXTURE_BOARDS.birchResearch].sort(),
    )
    expect(new Set(boards.map((board) => board.agentId))).toEqual(
      new Set([FIXTURE_AGENTS.quill, FIXTURE_AGENTS.birch]),
    )
  })

  it('shows two boards to a human operating one agent that holds two boards', async () => {
    const gateway = createFixtureTaskGateway()

    const boards = await gateway.listVisibleBoards(FIXTURE_HUMANS.ash)

    expect(boards.map((board) => board.id).sort()).toEqual(
      [FIXTURE_BOARDS.marlowOutreach, FIXTURE_BOARDS.marlowBacklog].sort(),
    )
    expect(boards.every((board) => board.agentId === FIXTURE_AGENTS.marlow)).toBe(true)
  })

  it('shows no boards at all to a human operating no agents', async () => {
    const gateway = createFixtureTaskGateway()

    const boards = await gateway.listVisibleBoards(FIXTURE_HUMANS.rook)

    expect(boards).toEqual([])
  })

  it('never lists a board belonging to another human\'s agent', async () => {
    const gateway = createFixtureTaskGateway()

    const boards = await gateway.listVisibleBoards(FIXTURE_HUMANS.wren)

    expect(boards.map((board) => board.id)).not.toContain(FIXTURE_BOARDS.marlowOutreach)
  })
})
