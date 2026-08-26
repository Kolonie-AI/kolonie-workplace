/**
 * Workplace-owned, disposable types for the UI-first spike.
 *
 * These are not a `kolonie-platform` schema proposal and must not be described
 * as one. The Colony remains the source of truth for work state; everything in
 * `src/domain` exists only so the workplace UI can be designed against typed
 * fixtures, and is expected to be thrown away once the platform contract exists.
 */

export const WORKPLACE_LANES = [
  'inbox',
  'ready',
  'in_progress',
  'blocked',
  'review',
  'done',
] as const

export type Lane = (typeof WORKPLACE_LANES)[number]

export function isLane(candidate: string): candidate is Lane {
  return (WORKPLACE_LANES as readonly string[]).includes(candidate)
}
