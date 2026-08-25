import { describe, expect, it } from 'vitest'
import { resolveRecommendation } from '@/domain/recommendation'
import type { WorkItem, Workplace } from '@/domain/workplace'
import { workplaceFixture } from '@/mock/workplaceFixture'

function itemsOf(workplace: Workplace): readonly WorkItem[] {
  return workplace.workItems
}

describe('resolveRecommendation', () => {
  it('resolves the item the gateway named', () => {
    const resolved = resolveRecommendation(workplaceFixture.recommendation, itemsOf(workplaceFixture))

    expect(resolved.status).toBe('available')
    if (resolved.status !== 'available') throw new Error('expected an available recommendation')
    expect(resolved.item.id).toBe('item-draft-shelf-playbook')
    expect(resolved.reason).toBe(workplaceFixture.recommendation?.reason)
  })

  it('reports missing when the gateway named no recommendation', () => {
    const resolved = resolveRecommendation(null, itemsOf(workplaceFixture))

    expect(resolved.status).toBe('unavailable')
    if (resolved.status !== 'unavailable') throw new Error('expected an unavailable recommendation')
    expect(resolved.cause).toBe('missing')
  })

  it('reports unknown when the named item is not in the work items', () => {
    const resolved = resolveRecommendation(
      { workItemId: 'item-that-does-not-exist', reason: 'stale pointer' },
      itemsOf(workplaceFixture),
    )

    expect(resolved.status).toBe('unavailable')
    if (resolved.status !== 'unavailable') throw new Error('expected an unavailable recommendation')
    expect(resolved.cause).toBe('unknown')
    expect(resolved.workItemId).toBe('item-that-does-not-exist')
  })

  it('never falls back to another work item when the recommendation cannot be resolved', () => {
    const missing = resolveRecommendation(null, itemsOf(workplaceFixture))
    const unknown = resolveRecommendation({ workItemId: 'nope', reason: 'x' }, itemsOf(workplaceFixture))

    expect(missing).not.toHaveProperty('item')
    expect(unknown).not.toHaveProperty('item')
  })
})
