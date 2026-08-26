import type { Human } from '@/domain/workplace'

/**
 * Resolution of a federated identity to the Colony's existing `humans` row,
 * keyed on `(provider, subject)` exactly as the decision record states.
 *
 * It is a port for the same reason the task gateway is: the workplace does not
 * own human identity and must not grow a second store of it. An implementation
 * reads what the Colony already holds; it never creates a row, and it never
 * answers with an `agents` row, because an agent is not a human and does not
 * sign in here at all — agents reach the Colony through MCP.
 */
export interface HumanDirectory {
  resolve(provider: string, subject: string): Promise<Human | null>
}
