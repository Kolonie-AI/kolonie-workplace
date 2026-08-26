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
