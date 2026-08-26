import { describe, expect, it } from 'vitest'
import { BoardAccessRefused, WorkItemAccessRefused } from '@/gateway/refusals'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS, FIXTURE_ITEMS } from '@/fixtures/catalogue'

describe('rejection case: a board belonging to another human\'s agent', () => {
  it('refuses the foreign board when it is addressed directly', async () => {
    const gateway = createFixtureTaskGateway()

    await expect(
      gateway.getBoardItems(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.marlowOutreach),
    ).rejects.toBeInstanceOf(BoardAccessRefused)
  })

  it('refuses rather than returning the foreign board\'s items', async () => {
    const gateway = createFixtureTaskGateway()

    const refusal = await gateway
      .getBoardItems(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.marlowOutreach)
      .then(() => null)
      .catch((error: unknown) => error)

    expect(refusal).toBeInstanceOf(BoardAccessRefused)
    expect((refusal as BoardAccessRefused).boardId).toBe(FIXTURE_BOARDS.marlowOutreach)
    expect((refusal as BoardAccessRefused).message).not.toContain('Outreach')
  })

  it('keeps a refused foreign board distinct from an existing empty board', async () => {
    const gateway = createFixtureTaskGateway()

    await expect(
      gateway.getBoardItems(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.marlowOutreach),
    ).rejects.toBeInstanceOf(BoardAccessRefused)
    await expect(
      gateway.getBoardItems(FIXTURE_HUMANS.ash, FIXTURE_BOARDS.marlowBacklog),
    ).resolves.toEqual([])
  })

  it('refuses a board id nobody holds, and refuses for a human with no agents', async () => {
    const gateway = createFixtureTaskGateway()

    await expect(
      gateway.getBoardItems(FIXTURE_HUMANS.wren, 'fictional-board-nobody-holds'),
    ).rejects.toBeInstanceOf(BoardAccessRefused)
    await expect(
      gateway.getBoardItems(FIXTURE_HUMANS.rook, FIXTURE_BOARDS.quillDelivery),
    ).rejects.toBeInstanceOf(BoardAccessRefused)
  })

  it('refuses an item that lives on a foreign board', async () => {
    const gateway = createFixtureTaskGateway()

    await expect(
      gateway.getItemDetail(FIXTURE_HUMANS.wren, 'fictional-item-foreign'),
    ).rejects.toBeInstanceOf(WorkItemAccessRefused)
    await expect(
      gateway.getItemDetail(FIXTURE_HUMANS.ash, FIXTURE_ITEMS.review),
    ).rejects.toBeInstanceOf(WorkItemAccessRefused)
  })
})
