import type { Recommendation, WorkItem } from '@/domain/workplace'

export type RecommendationUnavailableCause = 'missing' | 'unknown'

export type ResolvedRecommendation =
  | { readonly status: 'available'; readonly item: WorkItem; readonly reason: string }
  | {
      readonly status: 'unavailable'
      readonly cause: RecommendationUnavailableCause
      readonly workItemId: string | null
    }

/**
 * Resolves the recommendation the gateway supplied against the work items it
 * supplied alongside it. It applies no prioritisation of its own: if the named
 * item is absent or unknown the result is unavailable, never a different item.
 */
export function resolveRecommendation(
  recommendation: Recommendation | null,
  workItems: readonly WorkItem[],
): ResolvedRecommendation {
  if (recommendation === null) {
    return { status: 'unavailable', cause: 'missing', workItemId: null }
  }

  const item = workItems.find((candidate) => candidate.id === recommendation.workItemId)
  if (item === undefined) {
    return { status: 'unavailable', cause: 'unknown', workItemId: recommendation.workItemId }
  }

  return { status: 'available', item, reason: recommendation.reason }
}
