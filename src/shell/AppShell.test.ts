import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import AppShell from '@/shell/AppShell.vue'

describe('AppShell', () => {
  it('renders a persistent sidebar, top bar, board header and canvas', () => {
    render(AppShell)

    expect(screen.getByTestId('sidebar').tagName).toBe('ASIDE')
    expect(screen.getByTestId('topbar').tagName).toBe('HEADER')
    expect(screen.getByTestId('board-header').tagName).toBe('HEADER')
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('kanban')
  })

  it('renders exactly the two requested view tabs', () => {
    render(AppShell)

    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab')

    expect(tabs).toHaveLength(2)
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Kanban', 'List'])
    expect(screen.queryByRole('tab', { name: /table/i })).toBeNull()
    expect(screen.queryByRole('tab', { name: /gantt/i })).toBeNull()
  })

  it('opens with Kanban active and its placeholder canvas visible', () => {
    render(AppShell)

    expect(screen.getByRole('tab', { name: 'Kanban' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'List' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tabpanel').textContent).toContain('Kanban canvas')
    expect(screen.getByRole('tabpanel').textContent).not.toContain('List canvas')
  })

  it('activates List and replaces the canvas when its tab is selected', async () => {
    render(AppShell)

    await fireEvent.click(screen.getByRole('tab', { name: 'List' }))

    expect(screen.getByRole('tab', { name: 'Kanban' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tab', { name: 'List' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('list')
    expect(screen.getByRole('tabpanel').textContent).toContain('List canvas')
    expect(screen.getByRole('tabpanel').textContent).not.toContain('Kanban canvas')
  })

  it('links the active tab to its panel for assistive technology', async () => {
    render(AppShell)

    const kanbanTab = screen.getByRole('tab', { name: 'Kanban' })
    const panel = screen.getByRole('tabpanel')

    expect(kanbanTab.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(kanbanTab.id)

    await fireEvent.click(screen.getByRole('tab', { name: 'List' }))

    const listTab = screen.getByRole('tab', { name: 'List' })
    expect(listTab.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(listTab.id)
  })
})

describe('AppShell — rejection: an unknown requested view', () => {
  it('falls back to Kanban without rendering a third canvas or crashing', () => {
    render(AppShell, { props: { initialView: 'gantt' } })

    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.getByRole('tabpanel').getAttribute('data-view')).toBe('kanban')
    expect(screen.getByRole('tabpanel').textContent).toContain('Kanban canvas')
    expect(screen.queryByText(/gantt canvas/i)).toBeNull()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })
})

describe('AppShell — responsive contract', () => {
  it('marks the sidebar as collapsible and gives the canvas its own region', () => {
    render(AppShell)

    expect(screen.getByTestId('sidebar').classList.contains('app-shell__sidebar')).toBe(true)
    expect(screen.getByRole('main').classList.contains('app-shell__main')).toBe(true)
  })
})
