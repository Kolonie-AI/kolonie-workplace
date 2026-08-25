import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import WorkplaceScreen from '@/components/WorkplaceScreen.vue'
import { createMockTaskGateway } from '@/mock/mockTaskGateway'
import { workplaceFixture } from '@/mock/workplaceFixture'
import type { Workplace } from '@/domain/workplace'

function renderScreen(workplace: Workplace = workplaceFixture) {
  return render(WorkplaceScreen, {
    props: { gateway: createMockTaskGateway(workplace) },
  })
}

describe('WorkplaceScreen — valid recommendation path', () => {
  it('shows citizen identity, profession, mission, venture and milestone', async () => {
    renderScreen()

    expect(await screen.findByText(workplaceFixture.citizen.displayName)).toBeTruthy()
    expect(screen.getByText(workplaceFixture.citizen.profession.title)).toBeTruthy()
    expect(screen.getByText(workplaceFixture.citizen.mission.thesis)).toBeTruthy()
    expect(screen.getByText(workplaceFixture.venture.name)).toBeTruthy()
    expect(screen.getByText(workplaceFixture.venture.milestone.title)).toBeTruthy()
  })

  it('highlights exactly one recommended work item and explains why', async () => {
    renderScreen()

    const recommendation = await screen.findByTestId('recommendation')
    expect(within(recommendation).getByText('Draft the mailbox-shelf playbook')).toBeTruthy()
    expect(within(recommendation).getByTestId('recommendation-reason').textContent).toContain(
      'only active item',
    )
    expect(screen.queryAllByTestId('recommendation')).toHaveLength(1)
  })

  it('lists the surrounding work items grouped by ready, active, blocked and completed', async () => {
    renderScreen()

    for (const state of ['ready', 'active', 'blocked', 'completed'] as const) {
      const group = await screen.findByTestId(`work-item-group-${state}`)
      const expected = workplaceFixture.workItems.filter((item) => item.state === state)
      expect(within(group).getAllByTestId('work-item')).toHaveLength(expected.length)
    }
  })

  it('opens an item to reveal goal, blockers, operator-needed state, handover and evidence', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: /Complete provider E signup/ }))
    const detail = await screen.findByTestId('work-item-detail')
    expect(within(detail).getByText('Complete provider E signup')).toBeTruthy()
    expect(within(detail).getByText(workplaceFixture.workItems[2]?.goal ?? '')).toBeTruthy()
    const blocker = within(detail).getByTestId('blocker')
    expect(within(blocker).getByText(/asks for a payment instrument/)).toBeTruthy()
    expect(within(blocker).getByTestId('operator-needed')).toBeTruthy()
    expect(within(blocker).getByText(/Smallest unblock:/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Draft the mailbox-shelf playbook/ }))
    const activeDetail = await screen.findByTestId('work-item-detail')
    expect(within(activeDetail).getByTestId('handover-summary').textContent).toContain('Steps one to four')
    expect(within(activeDetail).getByTestId('handover-learned')).toBeTruthy()
    expect(within(activeDetail).getByTestId('handover-resume-with')).toBeTruthy()
    expect(within(activeDetail).getAllByTestId('evidence-item')).toHaveLength(2)
  })
})

describe('WorkplaceScreen — recommendation rejection path', () => {
  it('shows a visible unavailable state when no recommendation is supplied', async () => {
    renderScreen({ ...workplaceFixture, recommendation: null })

    const unavailable = await screen.findByTestId('recommendation-unavailable')
    expect(unavailable.textContent).toContain('no recommended action')
    expect(screen.queryByTestId('recommendation')).toBeNull()
  })

  it('shows a visible unavailable state when the recommendation names an unknown item', async () => {
    renderScreen({
      ...workplaceFixture,
      recommendation: { workItemId: 'item-that-does-not-exist', reason: 'stale pointer' },
    })

    const unavailable = await screen.findByTestId('recommendation-unavailable')
    expect(unavailable.textContent).toContain('unknown work item')
    expect(screen.queryByTestId('recommendation')).toBeNull()
  })

  it('does not silently fall back to another work item', async () => {
    renderScreen({ ...workplaceFixture, recommendation: null })

    await screen.findByTestId('recommendation-unavailable')
    expect(screen.queryByTestId('recommendation')).toBeNull()
    for (const item of workplaceFixture.workItems) {
      expect(screen.queryByTestId(`recommended-${item.id}`)).toBeNull()
    }
  })

  it('still renders the surrounding work state so the operator is not stranded', async () => {
    renderScreen({ ...workplaceFixture, recommendation: null })

    expect(await screen.findByText(workplaceFixture.venture.name)).toBeTruthy()
    expect(screen.getAllByTestId('work-item')).toHaveLength(workplaceFixture.workItems.length)
  })
})
