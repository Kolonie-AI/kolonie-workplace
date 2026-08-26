import { describe, expect, it } from 'vitest'
import {
  fixtureAgents,
  fixtureBoards,
  fixtureHumans,
  fixtureWorkItems,
  FIXTURE_IDENTITIES,
} from '@/fixtures/catalogue'
import { isLane } from '@/domain/lanes'

const ALL_TEXT = [
  ...fixtureHumans.map((human) => human.name),
  ...Object.values(FIXTURE_IDENTITIES).map((identity) => identity.subject),
  ...fixtureAgents.map((agent) => agent.name),
  ...fixtureBoards.map((board) => `${board.id} ${board.title}`),
  ...fixtureWorkItems.map(
    (item) =>
      `${item.id} ${item.title} ${item.owner} ${item.blocker?.actor ?? ''} ` +
      `${(item.handover?.evidence ?? []).map((entry) => `${entry.label} ${entry.href}`).join(' ')} ` +
      item.externalReferences.map((reference) => `${reference.label} ${reference.href}`).join(' '),
  ),
].join('\n')

describe('fixture hygiene', () => {
  it('names every fixture human and agent obviously fictional', () => {
    expect(fixtureHumans.every((human) => human.name.startsWith('Fictional '))).toBe(true)
    expect(fixtureAgents.every((agent) => agent.name.startsWith('Fictional '))).toBe(true)
  })

  it('carries no host name, IP address, URL, email address or token-shaped string', () => {
    expect(ALL_TEXT).not.toMatch(/https?:\/\//)
    expect(ALL_TEXT).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/)
    expect(ALL_TEXT).not.toMatch(/@/)
    expect(ALL_TEXT).not.toMatch(/\b[a-z0-9-]+\.(ai|com|org|net|io|dev|sh)\b/i)
    expect(ALL_TEXT).not.toMatch(/\b(token|secret|password|api[-_]?key|bearer)\b/i)
  })

  it('names every fixture federated subject obviously fictional', () => {
    for (const identity of Object.values(FIXTURE_IDENTITIES)) {
      expect(identity.subject.startsWith('fictional-subject-')).toBe(true)
    }
  })

  /**
   * The provider is the Colony's own name for a door, and one of them is
   * literally `password` — which is why the providers are checked against the
   * known set here rather than swept for token-shaped words above. A door name
   * is not a credential, and the set is what a wrong one would break.
   */
  it('names each door with a provider the Colony already uses', () => {
    const doors = new Set(['google', 'github', 'x', 'password'])

    for (const identity of Object.values(FIXTURE_IDENTITIES)) {
      expect(doors.has(identity.provider)).toBe(true)
    }
  })

  it('places every fixture item in one of the six fixed lanes and on a known board', () => {
    const boardIds = new Set(fixtureBoards.map((board) => board.id))

    expect(fixtureWorkItems.every((item) => isLane(item.lane))).toBe(true)
    expect(fixtureWorkItems.every((item) => boardIds.has(item.boardId))).toBe(true)
  })

  it('encodes the cardinality the product depends on: 0..n agents, 0..n boards', () => {
    const agentCounts = fixtureHumans.map((human) => human.agentIds.length)
    const boardCounts = fixtureAgents.map((agent) => agent.boardIds.length)

    expect(agentCounts).toContain(0)
    expect(agentCounts).toContain(1)
    expect(agentCounts).toContain(2)
    expect(boardCounts).toContain(1)
    expect(boardCounts).toContain(2)
  })
})
