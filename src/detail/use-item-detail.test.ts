import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { HumanId, WorkItemDetail, WorkItemId } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/task-gateway'
import { WorkItemAccessRefused } from '@/gateway/refusals'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_HUMANS, FIXTURE_ITEMS } from '@/fixtures/catalogue'
import { useItemDetail } from '@/detail/use-item-detail'

async function settled(): Promise<void> {
  await nextTick()
  await nextTick()
  await nextTick()
}

function gatewayServing(details: Readonly<Record<string, WorkItemDetail>>): TaskGateway {
  return {
    listVisibleBoards: vi.fn(async () => []),
    getBoardItems: vi.fn(async () => []),
    getItemDetail: vi.fn(async (_humanId: HumanId, itemId: WorkItemId) => {
      const detail = details[itemId]

      if (detail === undefined) {
        throw new WorkItemAccessRefused(itemId)
      }

      return detail
    }),
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
      listCardLinks: vi.fn(),
      addCardLink: vi.fn(),
      removeCardLink: vi.fn(),
  }
}

describe('item detail — loaded on open, never with the board', () => {
  it('asks the gateway for nothing while no item is selected', async () => {
    const gateway = gatewayServing({})
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), ref(null))

    await settled()

    expect(gateway.getItemDetail).not.toHaveBeenCalled()
    expect(detail.status.value).toBe('idle')
    expect(detail.item.value).toBeNull()
  })

  it('fetches through the gateway detail call when an item is opened', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getItemDetail')
    const selectedItemId = ref<WorkItemId | null>(null)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)

    await settled()
    expect(spy).not.toHaveBeenCalled()

    selectedItemId.value = FIXTURE_ITEMS.review
    await settled()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.review)
    expect(detail.status.value).toBe('ready')
    expect(detail.item.value?.id).toBe(FIXTURE_ITEMS.review)
  })

  it('asks once per opened item and not once per item on the board', async () => {
    const gateway = createFixtureTaskGateway()
    const spy = vi.spyOn(gateway, 'getItemDetail')
    const selectedItemId = ref<WorkItemId | null>(null)
    useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)

    selectedItemId.value = FIXTURE_ITEMS.review
    await settled()
    selectedItemId.value = FIXTURE_ITEMS.blocked
    await settled()

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy.mock.calls.map(([, itemId]) => itemId)).toEqual([
      FIXTURE_ITEMS.review,
      FIXTURE_ITEMS.blocked,
    ])
  })

  it('clears the loaded detail when the selection is closed', async () => {
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.review)
    const detail = useItemDetail(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      selectedItemId,
    )

    await settled()
    expect(detail.item.value?.id).toBe(FIXTURE_ITEMS.review)

    selectedItemId.value = null
    await settled()

    expect(detail.item.value).toBeNull()
    expect(detail.status.value).toBe('idle')
  })

  it('applies a lane change to the open item without a refetch', async () => {
    const gateway = createFixtureTaskGateway()
    const reads = vi.spyOn(gateway, 'getItemDetail')
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.review)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()

    expect(detail.item.value?.lane).toBe('review')
    const readsAfterOpen = reads.mock.calls.length
    detail.applyLane(FIXTURE_ITEMS.review, 'done')

    expect(detail.item.value?.lane).toBe('done')
    expect(reads).toHaveBeenCalledTimes(readsAfterOpen)
  })
})

describe('item detail — writes update the open item', () => {
  it('updates through the gateway and keeps the returned detail locally', async () => {
    const gateway = createFixtureTaskGateway()
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.review)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()

    const updated = await detail.updateItem({ title: 'Revised through the detail' })

    expect(updated?.title).toBe('Revised through the detail')
    expect(detail.item.value?.title).toBe('Revised through the detail')
    expect(detail.updateError.value).toBeNull()
  })

  it('loads canonical history and outcome independently from card detail', async () => {
    const gateway = createFixtureTaskGateway()
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.done)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()

    expect(detail.status.value).toBe('ready')
    expect(detail.historyStatus.value).toBe('ready')
    expect(detail.historyEvents.value.map((event) => event.id)).toEqual([
      'fictional-event-created',
      'fictional-event-moved',
      'fictional-event-closed',
    ])
    expect(detail.outcomeStatus.value).toBe('ready')
    expect(detail.outcomeClosures.value.map((closure) => closure.revision)).toEqual([2, 1])
  })

  it('prepends earlier events without moving or duplicating the loaded page', async () => {
    const gateway = createFixtureTaskGateway()
    const all = await gateway.listCardEvents?.(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.done)
    const events = all?.items ?? []
    vi.spyOn(gateway, 'listCardEvents').mockImplementation(async (_human, _item, cursor) =>
      cursor === undefined
        ? { items: [events[0]!, events[1]!], nextCursor: 'earlier' }
        : { items: [events[1]!, events[2]!], nextCursor: null },
    )
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.done)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()

    expect(detail.historyEvents.value.map((event) => event.id)).toEqual([
      'fictional-event-moved',
      'fictional-event-closed',
    ])
    expect(detail.historyHasEarlier.value).toBe(true)

    await detail.loadEarlierEvents()

    expect(detail.historyEvents.value.map((event) => event.id)).toEqual([
      'fictional-event-created',
      'fictional-event-moved',
      'fictional-event-closed',
    ])
    expect(detail.historyHasEarlier.value).toBe(false)
  })

  it('keeps Discussion and Outcome available when History fails, then retries only History', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'listCardEvents').mockRejectedValueOnce(new Error('history unavailable'))
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.done)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()

    expect(detail.item.value).not.toBeNull()
    expect(detail.historyStatus.value).toBe('error')
    expect(detail.outcomeStatus.value).toBe('ready')

    detail.retryHistory()
    await settled()

    expect(detail.historyStatus.value).toBe('ready')
    expect(detail.historyEvents.value.length).toBeGreaterThan(0)
  })

  it('clears card, history and outcome when a memory endpoint returns the non-disclosing 404', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'listCardEvents').mockRejectedValueOnce(
      new WorkItemAccessRefused(FIXTURE_ITEMS.done),
    )
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.done)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()

    expect(detail.status.value).toBe('refused')
    expect(detail.item.value).toBeNull()
    expect(detail.historyEvents.value).toEqual([])
    expect(detail.outcomeClosures.value).toEqual([])
  })

  it('restores the previous detail when a write fails', async () => {
    const gateway = createFixtureTaskGateway()
    vi.spyOn(gateway, 'updateWorkItem').mockRejectedValue(new Error('write unavailable'))
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.review)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()
    const previous = detail.item.value

    const updated = await detail.updateItem({ title: 'This write fails' })

    expect(updated).toBeNull()
    expect(detail.item.value).toEqual(previous)
    expect(detail.updateError.value).toMatch(/failed/i)
  })

  it('creates, ticks and restores a rejected checklist write', async () => {
    const gateway = createFixtureTaskGateway()
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.ready)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()

    const added = await detail.createChecklistItem('Draft fictional introduction')
    expect(added?.checklist).toHaveLength(1)
    expect(detail.item.value?.checklist[0]?.title).toBe('Draft fictional introduction')

    const checklistId = added!.checklist[0]!.id
    vi.spyOn(gateway, 'updateChecklistItem').mockRejectedValueOnce(new Error('write unavailable'))
    const ticked = await detail.updateChecklistItem(checklistId, { done: true })

    expect(ticked).toBeNull()
    expect(detail.item.value?.checklist[0]?.done).toBe(false)
    expect(detail.updateError.value).toMatch(/failed/i)
  })

  it('creates a comment and restores the thread when the write fails', async () => {
    const gateway = createFixtureTaskGateway()
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.ready)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()

    const added = await detail.createComment(
      'Fictional Human Wren',
      '<p>Please review the fictional outline.</p>',
    )
    expect(added?.comments).toHaveLength(1)
    expect(detail.item.value?.comments[0]?.body).toContain('Please review')

    vi.spyOn(gateway, 'createComment').mockRejectedValueOnce(new Error('write unavailable'))
    const failed = await detail.createComment(
      'Fictional Human Wren',
      '<p>This write fails.</p>',
    )

    expect(failed).toBeNull()
    expect(detail.item.value?.comments).toHaveLength(1)
    expect(detail.updateError.value).toMatch(/failed/i)
  })

  it('adds and deletes an attachment through the gateway', async () => {
    const gateway = createFixtureTaskGateway()
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.ready)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()
    const file = new File(['fictional notes'], 'fictional-notes.txt', { type: 'text/plain' })

    const added = await detail.addAttachment({
      name: file.name,
      size: file.size,
      mimeType: file.type,
      file,
    })
    expect(added?.attachments).toHaveLength(1)
    expect(detail.item.value?.attachments[0]?.name).toBe('fictional-notes.txt')

    const removed = await detail.deleteAttachment(added!.attachments[0]!.id)
    expect(removed?.attachments).toEqual([])
    expect(detail.item.value?.attachments).toEqual([])
  })

  it('adds and removes a typed card link through the gateway', async () => {
    const gateway = createFixtureTaskGateway()
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.ready)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)
    await settled()

    const added = await detail.addCardLink({ kind: 'vault', ref: 'fictional/mailbox' })
    expect(added?.links).toHaveLength(1)
    expect(detail.item.value?.links[0]).toMatchObject({
      kind: 'vault',
      ref: 'fictional/mailbox',
      summary: 'fictional/mailbox',
    })
    expect(detail.item.value?.links[0]).not.toHaveProperty('value')

    const removed = await detail.removeCardLink(added!.links[0]!.id)
    expect(removed?.links).toEqual([])
    expect(detail.item.value?.links).toEqual([])
  })
})

describe('item detail — rejection: an item on a board this human may not open', () => {
  it('refuses without rendering any part of the detail', async () => {
    const selectedItemId = ref<WorkItemId | null>(null)
    const detail = useItemDetail(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      selectedItemId,
    )

    selectedItemId.value = 'fictional-item-foreign'
    await settled()

    expect(detail.status.value).toBe('refused')
    expect(detail.item.value).toBeNull()
  })

  it('keeps a refusal distinct from a read that failed', async () => {
    const selectedItemId = ref<WorkItemId | null>(null)
    const detail = useItemDetail(
      {
        listVisibleBoards: vi.fn(async () => []),
        getBoardItems: vi.fn(async () => []),
        getItemDetail: vi.fn(async () => {
          throw new Error('Kolonie Workplace: the detail could not be read.')
        }),
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
      listCardLinks: vi.fn(),
      addCardLink: vi.fn(),
      removeCardLink: vi.fn(),
      },
      ref(FIXTURE_HUMANS.wren),
      selectedItemId,
    )

    selectedItemId.value = FIXTURE_ITEMS.review
    await settled()

    expect(detail.status.value).toBe('error')
    expect(detail.item.value).toBeNull()
  })

  it('does not leave a previous item on screen while the next one is refused', async () => {
    const selectedItemId = ref<WorkItemId | null>(FIXTURE_ITEMS.review)
    const detail = useItemDetail(
      createFixtureTaskGateway(),
      ref(FIXTURE_HUMANS.wren),
      selectedItemId,
    )

    await settled()
    expect(detail.item.value?.id).toBe(FIXTURE_ITEMS.review)

    selectedItemId.value = 'fictional-item-foreign'
    await settled()

    expect(detail.item.value).toBeNull()
    expect(detail.status.value).toBe('refused')
  })
})

describe('item detail — a slow read that is overtaken', () => {
  it('renders the item that was opened last, not the one that answered last', async () => {
    const review = await createFixtureTaskGateway().getItemDetail(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.review,
    )
    const blocked = await createFixtureTaskGateway().getItemDetail(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.blocked,
    )
    const releases: Array<() => void> = []
    const gateway: TaskGateway = {
      listVisibleBoards: vi.fn(async () => []),
      getBoardItems: vi.fn(async () => []),
      getItemDetail: vi.fn(
        (_humanId: HumanId, itemId: WorkItemId) =>
          new Promise<WorkItemDetail>((resolve) => {
            releases.push(() => {
              resolve(itemId === review.id ? review : blocked)
            })
          }),
      ),
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
      listCardLinks: vi.fn(),
      addCardLink: vi.fn(),
      removeCardLink: vi.fn(),
    }
    const selectedItemId = ref<WorkItemId | null>(null)
    const detail = useItemDetail(gateway, ref(FIXTURE_HUMANS.wren), selectedItemId)

    selectedItemId.value = review.id
    await settled()
    selectedItemId.value = blocked.id
    await settled()

    releases[1]?.()
    await settled()
    releases[0]?.()
    await settled()

    expect(detail.item.value?.id).toBe(blocked.id)
  })
})
