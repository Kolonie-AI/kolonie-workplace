import type { AgentId, VisibleBoard } from '@/domain/workplace'

/**
 * A board hangs off an agent, and a human reaches it because they operate that
 * agent. Grouping is therefore by agent and never by human, and a group carries
 * a list of boards rather than one board, so nothing here assumes one board per
 * agent or one board per human.
 */
export interface BoardGroup {
  readonly agentId: AgentId
  readonly agentName: string
  readonly profession: string | null
  readonly boards: readonly VisibleBoard[]
}

export function groupBoardsByAgent(boards: readonly VisibleBoard[]): readonly BoardGroup[] {
  const order: AgentId[] = []
  const collected = new Map<
    AgentId,
    { agentName: string; profession: string | null; boards: VisibleBoard[] }
  >()

  for (const board of boards) {
    const existing = collected.get(board.agentId)

    if (existing === undefined) {
      order.push(board.agentId)
      collected.set(board.agentId, {
        agentName: board.agentName,
        profession: board.profession,
        boards: [board],
      })
      continue
    }

    existing.boards.push(board)
  }

  return order.map((agentId) => {
    const group = collected.get(agentId)

    return {
      agentId,
      agentName: group?.agentName ?? '',
      profession: group?.profession ?? null,
      boards: group?.boards ?? [],
    }
  })
}
