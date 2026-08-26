import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import AppShell from '@/shell/AppShell.vue'

function renderShell(props: { initialView?: unknown } = {}) {
  return render(AppShell, {
    props,
    global: { provide: { [TASK_GATEWAY]: createFixtureTaskGateway() } },
  })
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

  it('opens with Kanban active and its placeholder canvas visible', () => {
    renderShell()

    expect(screen.getByRole('tab', { name: 'Kanban' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'List' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tabpanel').textContent).toContain('Kanban canvas')
    expect(screen.getByRole('tabpanel').textContent).not.toContain('List canvas')
  })

  it('activates List and replaces the canvas when its tab is selected', async () => {
    renderShell()

    await fireEvent.click(screen.getByRole('tab', { name: 'List' }))

    expect(screen.getByRole('tab', { name: 'Kanban' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tab', { name: 'List' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('list')
    expect(screen.getByRole('tabpanel').textContent).toContain('List canvas')
    expect(screen.getByRole('tabpanel').textContent).not.toContain('Kanban canvas')
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
    expect(screen.getByRole('tabpanel').textContent).toContain('List canvas')
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
    expect(screen.getByRole('tabpanel').textContent).toContain('Kanban canvas')
  })
})

describe('AppShell — rejection: an unknown requested view', () => {
  it('falls back to Kanban without rendering a third canvas or crashing', () => {
    renderShell({ initialView: 'gantt' })

    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('kanban')
    expect(screen.getByRole('tabpanel').textContent).toContain('Kanban canvas')
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
