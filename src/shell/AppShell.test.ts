import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { PREVIEW_DATA_GATEWAY, type TaskGateway } from '@/gateway/task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS, FIXTURE_ITEMS } from '@/fixtures/catalogue'
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
  createWorkItem: async () => Promise.reject(new Error('No write requested in this test.')),
  updateWorkItem: async () => Promise.reject(new Error('No write requested in this test.')),
  deleteWorkItem: async () => undefined,
  reorderWorkItem: async () => Promise.reject(new Error('No write requested in this test.')),
  createComment: async () => Promise.reject(new Error('No write requested in this test.')),
  updateComment: async () => Promise.reject(new Error('No write requested in this test.')),
  deleteComment: async () => Promise.reject(new Error('No write requested in this test.')),
  addAttachment: async () => Promise.reject(new Error('No write requested in this test.')),
  deleteAttachment: async () => Promise.reject(new Error('No write requested in this test.')),
  createChecklistItem: async () => Promise.reject(new Error('No write requested in this test.')),
  updateChecklistItem: async () => Promise.reject(new Error('No write requested in this test.')),
  reorderChecklistItem: async () => Promise.reject(new Error('No write requested in this test.')),
  deleteChecklistItem: async () => Promise.reject(new Error('No write requested in this test.')),
}

describe('AppShell', () => {
  it('renders a persistent sidebar, one board bar and canvas', () => {
    renderShell()

    expect(screen.getByTestId('sidebar').tagName).toBe('ASIDE')
    expect(screen.queryByTestId('topbar')).toBeNull()
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

    expect(indication.textContent?.trim()).toBe('Example data')
    expect(screen.getByTestId('board-header').contains(indication)).toBe(true)
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

  it('drives the attachment preview notice from the gateway flag, not a constant', async () => {
    const session = createFixtureWorkplaceSession()
    await session.signIn({ humanId: FIXTURE_HUMANS.wren })
    const inner = createFixtureTaskGateway()
    const live = new Proxy(inner, {
      get(target, prop, receiver) {
        if (prop === PREVIEW_DATA_GATEWAY) {
          return undefined
        }

        const value = Reflect.get(target, prop, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })

    render(AppShell, {
      props: { initialBoardId: FIXTURE_BOARDS.quillDelivery },
      global: {
        provide: {
          [WORKPLACE_SESSION]: session,
          [TASK_GATEWAY]: live,
        },
      },
    })

    const card = (await screen.findAllByTestId('kanban-card')).find(
      (candidate) => candidate.getAttribute('data-item-id') === FIXTURE_ITEMS.inProgress,
    )
    if (card === undefined) {
      throw new Error('Expected the in-progress fixture card.')
    }
    await fireEvent.click(card)

    expect(await screen.findByTestId('detail-pane')).toBeTruthy()
    expect(screen.queryByTestId('preview-data-indication')).toBeNull()
    expect(screen.queryByTestId('detail-attachment-preview-notice')).toBeNull()
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

describe('AppShell — responsive application chrome', () => {
  it('renders the Colony mark in the board bar', () => {
    renderShell()

    const mark = screen.getByRole('img', { name: 'Kolonie AI' })

    expect(mark.tagName).toBe('svg')
    expect(screen.getByTestId('board-header').contains(mark)).toBe(true)
  })

  it('collapses and expands the sidebar without losing the state on rerender', async () => {
    const { rerender } = renderShell()
    const shell = screen.getByTestId('app-shell')
    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' })

    await fireEvent.click(collapse)
    expect(shell.getAttribute('data-sidebar-collapsed')).toBe('true')
    expect(screen.getByTestId('sidebar').getAttribute('aria-label')).toBe('Collapsed board navigation')

    await rerender({ initialView: 'kanban' })
    expect(shell.getAttribute('data-sidebar-collapsed')).toBe('true')

    await fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(shell.getAttribute('data-sidebar-collapsed')).toBe('false')
  })

  it('opens the mobile navigation and closes it after a board is chosen', async () => {
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

    const menu = screen.getByRole('button', { name: 'Open board navigation' })
    await fireEvent.click(menu)
    expect(screen.getByTestId('app-shell').getAttribute('data-mobile-menu-open')).toBe('true')

    await fireEvent.click((await screen.findAllByTestId('board-link'))[0]!)
    expect(screen.getByTestId('app-shell').getAttribute('data-mobile-menu-open')).toBe('false')
  })

  it('uses tabbable native buttons for the keyboard-operable chrome', async () => {
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

    const menu = screen.getByRole('button', { name: 'Open board navigation' })
    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' })
    const boards = await screen.findAllByTestId('board-link')

    expect(menu.tagName).toBe('BUTTON')
    expect(collapse.tagName).toBe('BUTTON')
    expect(menu.tabIndex).not.toBe(-1)
    expect(collapse.tabIndex).not.toBe(-1)
    expect(boards.length).toBeGreaterThan(0)

    for (const board of boards) {
      expect(board.tagName).toBe('BUTTON')
      expect(board.tabIndex).not.toBe(-1)
    }

    collapse.focus()
    await fireEvent.click(collapse)
    expect(screen.getByTestId('app-shell').getAttribute('data-sidebar-collapsed')).toBe('true')

    menu.focus()
    await fireEvent.click(menu)
    expect(screen.getByTestId('app-shell').getAttribute('data-mobile-menu-open')).toBe('true')
  })

  it('opens the existing board search from the board bar', async () => {
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

    await fireEvent.click((await screen.findAllByTestId('board-link'))[0]!)
    await fireEvent.click(screen.getByRole('button', { name: 'Search this board' }))
    expect(document.activeElement).toBe(await screen.findByTestId('filter-search'))
  })

  it('opens the shortcut overlay from ? and lists the registered set', async () => {
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

    await fireEvent.keyDown(window, { key: '?' })
    const overlay = await screen.findByTestId('shortcut-overlay')
    expect(overlay.textContent).toMatch(/Filter cards/)
    expect(overlay.textContent).toMatch(/Show keyboard shortcuts/)
    expect(overlay.querySelectorAll('kbd')).toHaveLength(2)

    await fireEvent.click(screen.getByTestId('shortcut-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('shortcut-overlay')).toBeNull()
    })
  })

  it('restores focus to Filter cards after the popover closes', async () => {
    const session = createFixtureWorkplaceSession()
    await session.signIn({ humanId: FIXTURE_HUMANS.wren })
    render(AppShell, {
      props: { initialBoardId: FIXTURE_BOARDS.quillDelivery },
      global: {
        provide: {
          [WORKPLACE_SESSION]: session,
          [TASK_GATEWAY]: createFixtureTaskGateway(),
        },
      },
    })

    await waitFor(() => {
      expect(screen.getByTestId('filter-open')).toBeTruthy()
    })

    const opener = screen.getByTestId('filter-open')
    opener.focus()
    await fireEvent.click(opener)
    await waitFor(() => {
      expect(screen.getByTestId('filter-popover')).toBeTruthy()
    })

    await fireEvent.click(screen.getByTestId('filter-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('filter-popover')).toBeNull()
    })
    expect(document.activeElement).toBe(opener)
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
