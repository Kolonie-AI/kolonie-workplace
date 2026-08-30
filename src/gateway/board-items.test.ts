import { describe, expect, it } from 'vitest'
import { WORKPLACE_LANES } from '@/domain/lanes'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS, FIXTURE_ITEMS } from '@/fixtures/catalogue'

describe('board items', () => {
  it('returns work summaries spanning every fixed lane', async () => {
    const gateway = createFixtureTaskGateway()

    const items = await gateway.getBoardItems(
      FIXTURE_HUMANS.wren,
      FIXTURE_BOARDS.quillDelivery,
    )

    expect(new Set(items.map((item) => item.lane))).toEqual(new Set(WORKPLACE_LANES))
    expect(items).toHaveLength(WORKPLACE_LANES.length)
  })

  it('returns an empty item list for an existing empty board', async () => {
    const gateway = createFixtureTaskGateway()

    const items = await gateway.getBoardItems(
      FIXTURE_HUMANS.ash,
      FIXTURE_BOARDS.marlowBacklog,
    )

    expect(items).toEqual([])
    expect((await gateway.listVisibleBoards(FIXTURE_HUMANS.ash)).map(({ id }) => id))
      .toContain(FIXTURE_BOARDS.marlowBacklog)
  })

  it('keeps blocker and full handover data in item detail', async () => {
    const gateway = createFixtureTaskGateway()

    const blocked = await gateway.getItemDetail(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.blocked)
    const review = await gateway.getItemDetail(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.review)

    expect(blocked.blocker).toEqual({
      actor: 'Fictional Operator Ember',
      smallestUnblock: 'Choose one of the fictional delivery windows',
    })
    expect(review.handover).toEqual({
      done: 'Prepared the fictional catalogue for review',
      learned: 'The narrow fixture path is sufficient',
      next: 'Review the typed summaries',
      blocked: 'Nothing blocks the next step',
      evidence: [
        { label: 'Fictional typecheck evidence', href: '/fictional-evidence/typecheck' },
        { label: 'Fictional unit-test evidence', href: '/fictional-evidence/unit-test' },
      ],
    })
    expect(review.links).toEqual([
      {
        id: 'fictional-link-review-url',
        kind: 'url',
        ref: '/fictional-reference/review',
        note: 'Fictional review reference',
        state: 'resolved',
        summary: 'Fictional review reference',
      },
      {
        id: 'fictional-link-review-vault',
        kind: 'vault',
        ref: 'fictional/mailbox',
        state: 'resolved',
        summary: 'fictional/mailbox',
      },
    ])
    expect(review.links.every((link) => !('value' in link))).toBe(true)
  })
})
