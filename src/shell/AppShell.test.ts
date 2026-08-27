import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import type { TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { FIXTURE_HUMANS } from '@/fixtures/catalogue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION } from '@/session/workplace-session'
import AppShell from '@/shell/AppShell.vue'

function renderShell(
  props: { initialView?: unknown } = {},
  gateway: TaskGateway = createFixtureTaskGateway(),
) {
  return render(AppShell, {
    props,
    global: { provide: { [TASK_GATEWAY]: gateway } },
  })
}

const nonFixtureGateway: TaskGateway = {
  listVisibleBoards: async () => [],
  getBoardItems: async () => [],
  getItemDetail: async () => Promise.reject(new Error('No item requested in this test.')),
  moveItemToLane: async () => undefined,
}

describe('AppShell', () => {
  it('renders a persistent sidebar, top bar, board header and canvas', () => {
    renderShell()

    expect(screen.getByTestId('sidebar').tagName).toBe('ASIDE')
    expect(screen.getByTestId('topbar').tagName).toBe('HEADER')
    expect(screen.getByTestId('board-header').tagName).toBe('HEADER')
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('kanban')
  })

  it('renders exactly the two requested view tabs', () => {
    renderShell()

    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab')

    expect(tabs).toHaveLength(2)
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Kanban', 'List'])
    expect(screen.queryByRole('tab', { name: /table/i })).toBeNull()
    expect(screen.queryByRole('tab', { name: /gantt/i })).toBeNull()
  })

  it('opens with Kanban active and the Kanban board in the canvas', () => {
    renderShell()

    expect(screen.getByRole('tab', { name: 'Kanban' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'List' }).getAttribute('aria-selected')).toBe('false')
    expect(within(screen.getByRole('tabpanel')).getByTestId('kanban-board')).toBeTruthy()
    expect(screen.getByRole('tabpanel').textContent).not.toContain('List canvas')
  })

  it('activates List and replaces the canvas when its tab is selected', async () => {
    renderShell()

    await fireEvent.click(screen.getByRole('tab', { name: 'List' }))

    expect(screen.getByRole('tab', { name: 'Kanban' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tab', { name: 'List' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('list')
    expect(within(screen.getByRole('tabpanel')).getByTestId('list-view')).toBeTruthy()
    expect(within(screen.getByRole('tabpanel')).queryByTestId('kanban-board')).toBeNull()
  })

  it('jumps to the first and last tab with Home and End', async () => {
    renderShell()

    const kanbanTab = screen.getByRole('tab', { name: 'Kanban' })
    const listTab = screen.getByRole('tab', { name: 'List' })

    kanbanTab.focus()
    await fireEvent.keyDown(kanbanTab, { key: 'End' })

    expect(document.activeElement).toBe(listTab)
    expect(listTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('list')

    await fireEvent.keyDown(listTab, { key: 'Home' })

    expect(document.activeElement).toBe(kanbanTab)
    expect(kanbanTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('kanban')
  })

  it('leaves the tablist alone on a key it does not handle', async () => {
    renderShell()

    const kanbanTab = screen.getByRole('tab', { name: 'Kanban' })
    kanbanTab.focus()

    await fireEvent.keyDown(kanbanTab, { key: 'ArrowDown' })
    await fireEvent.keyDown(kanbanTab, { key: 'a' })

    expect(document.activeElement).toBe(kanbanTab)
    expect(kanbanTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('kanban')
  })

  it('links the active tab to its panel for assistive technology', async () => {
    renderShell()

    const kanbanTab = screen.getByRole('tab', { name: 'Kanban' })
    const panel = screen.getByRole('tabpanel')

    expect(kanbanTab.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(kanbanTab.id)

    await fireEvent.click(screen.getByRole('tab', { name: 'List' }))

    const listTab = screen.getByRole('tab', { name: 'List' })
    expect(listTab.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(listTab.id)
  })

  it('moves right to List, focusing and selecting it while updating the panel', async () => {
    renderShell()

    const kanbanTab = screen.getByRole('tab', { name: 'Kanban' })
    kanbanTab.focus()

    await fireEvent.keyDown(kanbanTab, { key: 'ArrowRight' })

    const listTab = screen.getByRole('tab', { name: 'List' })
    expect(document.activeElement).toBe(listTab)
    expect(kanbanTab.getAttribute('aria-selected')).toBe('false')
    expect(kanbanTab.getAttribute('tabindex')).toBe('-1')
    expect(listTab.getAttribute('aria-selected')).toBe('true')
    expect(listTab.getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('list')
    expect(within(screen.getByRole('tabpanel')).getByTestId('list-view')).toBeTruthy()
  })

  it('moves left to Kanban and wraps in both directions', async () => {
    renderShell()

    const kanbanTab = screen.getByRole('tab', { name: 'Kanban' })
    const listTab = screen.getByRole('tab', { name: 'List' })

    kanbanTab.focus()
    await fireEvent.keyDown(kanbanTab, { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(listTab)
    expect(listTab.getAttribute('aria-selected')).toBe('true')
    expect(listTab.getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('list')

    await fireEvent.keyDown(listTab, { key: 'ArrowRight' })

    expect(document.activeElement).toBe(kanbanTab)
    expect(kanbanTab.getAttribute('aria-selected')).toBe('true')
    expect(kanbanTab.getAttribute('tabindex')).toBe('0')
    expect(listTab.getAttribute('aria-selected')).toBe('false')
    expect(listTab.getAttribute('tabindex')).toBe('-1')
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('kanban')
    expect(within(screen.getByRole('tabpanel')).getByTestId('kanban-board')).toBeTruthy()
  })
})

describe('AppShell — preview data derives from the active gateway', () => {
  it('shows a quiet, persistent indication for the fixture gateway', async () => {
    renderShell()

    const indication = screen.getByTestId('preview-data-indication')

    expect(indication.textContent?.trim()).toBe(
      'Example data. Moves are session-local and not recorded.',
    )
    expect(screen.getByTestId('topbar').contains(indication)).toBe(true)
    expect(indication.getAttribute('role')).toBeNull()
    expect(indication.getAttribute('aria-live')).toBeNull()
    expect(indication.querySelector('button')).toBeNull()

    await fireEvent.click(screen.getByRole('tab', { name: 'List' }))

    expect(screen.getByTestId('preview-data-indication')).toBe(indication)
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('list')
  })

  it('does not render the indication for a non-fixture gateway', () => {
    renderShell({}, nonFixtureGateway)

    expect(screen.queryByTestId('preview-data-indication')).toBeNull()
    expect(screen.queryByText('Example data')).toBeNull()
  })

  it('stays put across a board change and an opened detail pane', async () => {
    const session = createFixtureWorkplaceSession()
    await session.signIn({ humanId: FIXTURE_HUMANS.wren })

    render(AppShell, {
      global: {
        provide: {
          [WORKPLACE_SESSION]: session,
          [TASK_GATEWAY]: createFixtureTaskGateway(),
        },
      },
    })

    const indication = await screen.findByTestId('preview-data-indication')
    const boards = await screen.findAllByTestId('board-link')

    for (const board of boards.slice(0, 2).reverse()) {
      await fireEvent.click(board)
      expect(screen.getByTestId('preview-data-indication')).toBe(indication)
    }

    const card = (await screen.findAllByTestId('kanban-card'))[0]

    if (card === undefined) {
      throw new Error('Expected a fixture card for the persistence check.')
    }

    await fireEvent.click(card)

    expect(await screen.findByTestId('detail-pane')).toBeTruthy()
    expect(screen.getByTestId('preview-data-indication')).toBe(indication)
  })
})

describe('AppShell — rejection: an unknown requested view', () => {
  it('falls back to Kanban without rendering a third canvas or crashing', () => {
    renderShell({ initialView: 'gantt' })

    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('kanban')
    expect(within(screen.getByRole('tabpanel')).getByTestId('kanban-board')).toBeTruthy()
    expect(screen.queryByText(/gantt canvas/i)).toBeNull()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })
})

describe('AppShell — responsive contract', () => {
  it('marks the sidebar as collapsible and gives the canvas its own region', () => {
    renderShell()

    expect(screen.getByTestId('sidebar').classList.contains('app-shell__sidebar')).toBe(true)
    expect(screen.getByRole('main').classList.contains('app-shell__main')).toBe(true)
  })
})
