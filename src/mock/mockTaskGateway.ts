import type { Workplace } from '@/domain/workplace'
import type { TaskGateway } from '@/gateway/TaskGateway'
import { workplaceFixture } from '@/mock/workplaceFixture'

/**
 * Read-only, in-memory adapter for the UI-first spike. It answers from a frozen
 * fixture and offers no way to write, so it cannot become a second source of truth.
 */
export function createMockTaskGateway(workplace: Workplace = workplaceFixture): TaskGateway {
  return {
    loadWorkplace: async () => workplace,
  }
}
