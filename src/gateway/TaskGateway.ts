import type { Workplace } from '@/domain/workplace'

/**
 * The Colony-owned boundary for every piece of workplace state a UI component
 * may read. It is read-only by design: the Colony remains the source of truth
 * and this application must not become a second task database.
 */
export interface TaskGateway {
  loadWorkplace(): Promise<Workplace>
}
