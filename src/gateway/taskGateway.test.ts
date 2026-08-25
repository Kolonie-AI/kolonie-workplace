import { describe, expect, it } from 'vitest'
import { createMockTaskGateway } from '@/mock/mockTaskGateway'
import type { TaskGateway } from '@/gateway/TaskGateway'

describe('mock TaskGateway', () => {
  const gateway: TaskGateway = createMockTaskGateway()

  it('exposes citizen identity, profession and mission', async () => {
    const workplace = await gateway.loadWorkplace()

    expect(workplace.citizen.handle).toBeTruthy()
    expect(workplace.citizen.profession.title).toBeTruthy()
    expect(workplace.citizen.mission.thesis).toBeTruthy()
  })

  it('exposes an active venture and its current milestone', async () => {
    const workplace = await gateway.loadWorkplace()

    expect(workplace.venture.name).toBeTruthy()
    expect(workplace.venture.milestone.title).toBeTruthy()
  })

  it('exposes at least six work items across ready, active, blocked and completed', async () => {
    const workplace = await gateway.loadWorkplace()
    const states = new Set(workplace.workItems.map((item) => item.state))

    expect(workplace.workItems.length).toBeGreaterThanOrEqual(6)
    expect(states).toContain('ready')
    expect(states).toContain('active')
    expect(states).toContain('blocked')
    expect(states).toContain('completed')
  })

  it('exposes exactly one operator-needed blocker', async () => {
    const workplace = await gateway.loadWorkplace()
    const operatorNeeded = workplace.workItems.filter((item) =>
      item.blockers.some((blocker) => blocker.operatorNeeded),
    )

    expect(operatorNeeded).toHaveLength(1)
  })

  it('names a recommended work item with an explicit reason', async () => {
    const workplace = await gateway.loadWorkplace()

    expect(workplace.recommendation?.workItemId).toBeTruthy()
    expect(workplace.recommendation?.reason).toBeTruthy()
  })

  it('carries a structured handover and evidence on at least one item', async () => {
    const workplace = await gateway.loadWorkplace()
    const withHandover = workplace.workItems.filter((item) => item.handover !== null)
    const withEvidence = workplace.workItems.filter((item) => item.evidence.length > 0)

    expect(withHandover.length).toBeGreaterThanOrEqual(1)
    expect(withEvidence.length).toBeGreaterThanOrEqual(1)
    const handover = withHandover[0]?.handover
    expect(handover?.summary).toBeTruthy()
    expect(handover?.learned).toBeTruthy()
    expect(handover?.resumeWith).toBeTruthy()
  })

  it('is read-only: it exposes no mutation entry point', () => {
    expect(Object.keys(gateway)).toEqual(['loadWorkplace'])
  })
})
