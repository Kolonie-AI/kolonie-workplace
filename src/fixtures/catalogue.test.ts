import { describe, expect, it } from 'vitest'
import {
  fixtureAgents,
  fixtureBoards,
  fixtureHumans,
  fixtureWorkItems,
} from '@/fixtures/catalogue'
import { isLane } from '@/domain/lanes'

const ALL_TEXT = [
  ...fixtureHumans.map((human) => human.name),
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
