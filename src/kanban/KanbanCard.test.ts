import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/vue'
import type { WorkItemSummary } from '@/domain/workplace'
import KanbanCard from '@/kanban/KanbanCard.vue'

function item(overrides: Partial<WorkItemSummary> = {}): WorkItemSummary {
  return {
    id: 'fictional-card',
    boardId: 'fictional-board',
    title: 'A fictional card',
    lane: 'ready',
    owner: 'Fictional Agent Quill',
    description: '',
    labels: [],
    assignees: [],
    priority: 'unset',
    dueDate: null,
    percentDone: 0,
    checklist: [],
    comments: [],
    attachments: [],
    coverColour: null,
    position: 0,
    ...overrides,
  }
}

function renderCard(overrides: Partial<WorkItemSummary> = {}) {
  return render(KanbanCard, {
    props: {
      item: item(overrides),
      selected: false,
      moving: false,
    },
  })
}

describe('KanbanCard — seven facets render only when their data is present', () => {
  it('leaves no empty boxes on a card that carries only a title', () => {
    renderCard()

    expect(screen.queryByTestId('kanban-card-cover')).toBeNull()
    expect(screen.queryByTestId('kanban-card-label')).toBeNull()
    expect(screen.queryByTestId('kanban-card-assignee')).toBeNull()
    expect(screen.queryByTestId('kanban-card-priority')).toBeNull()
    expect(screen.queryByTestId('kanban-card-due')).toBeNull()
    expect(screen.queryByTestId('kanban-card-checklist')).toBeNull()
    expect(screen.queryByTestId('kanban-card-counts')).toBeNull()
    expect(screen.getByTestId('kanban-card').textContent).toContain('A fictional card')
  })

  it('renders a colour stripe, labels, assignees, priority, due date, checklist and counts together', () => {
    renderCard({
      coverColour: '#1973ff',
      labels: [{ id: 'label-a', title: 'Delivery', colour: '#00db60' }],
      assignees: [{ id: 'human-wren', name: 'Fictional Human Wren' }],
      priority: 'high',
      dueDate: '2026-09-04',
      checklist: [
        { id: 'check-a', title: 'One', done: true, position: 0 },
        { id: 'check-b', title: 'Two', done: false, position: 1 },
      ],
      comments: [
        {
          id: 'comment-a',
          author: 'Fictional Human Wren',
          body: 'A note',
          createdAt: '2026-08-26T09:00:00.000Z',
          updatedAt: '2026-08-26T09:00:00.000Z',
        },
      ],
      attachments: [{ id: 'file-a', name: 'notes.txt', size: 12, mimeType: 'text/plain' }],
    })

    const card = screen.getByTestId('kanban-card')
    expect(card.getAttribute('data-cover-colour')).toBe('#1973ff')
    expect(screen.getByTestId('kanban-card-cover')).toBeTruthy()
    expect(screen.getByTestId('kanban-card-label').textContent).toContain('Delivery')
    expect(screen.getByTestId('kanban-card-assignee').textContent).toContain('FW')
    expect(screen.getByTestId('kanban-card-priority').textContent).toMatch(/high/i)
    expect(screen.getByTestId('kanban-card-due').textContent).toContain('2026-09-04')
    expect(screen.getByTestId('kanban-card-checklist').textContent).toMatch(/1\/2/)
    expect(screen.getByTestId('kanban-card-counts').textContent).toMatch(/1/)
  })

  it('paints a dark label with light text and a light label with dark text', () => {
    renderCard({
      labels: [
        { id: 'dark', title: 'Dark', colour: '#2b2d42' },
        { id: 'light', title: 'Light', colour: '#ffe066' },
      ],
    })

    const chips = screen.getAllByTestId('kanban-card-label')
    const dark = chips.find((chip) => chip.textContent?.includes('Dark'))
    const light = chips.find((chip) => chip.textContent?.includes('Light'))

    expect(dark?.style.color).toBe('var(--color-contrast-light)')
    expect(light?.style.color).toBe('var(--color-contrast-dark)')
    expect(dark?.style.color).not.toBe(light?.style.color)
  })

  it('marks an overdue date from a fixed clock and leaves an upcoming one unmarked', () => {
    const now = new Date('2026-08-27T12:00:00.000Z')

    const overdue = render(KanbanCard, {
      props: {
        item: item({ dueDate: '2026-08-20' }),
        selected: false,
        moving: false,
        now,
      },
    })
    expect(overdue.getByTestId('kanban-card-due').getAttribute('data-due-state')).toBe('overdue')
    overdue.unmount()

    const upcoming = render(KanbanCard, {
      props: {
        item: item({ dueDate: '2026-09-04' }),
        selected: false,
        moving: false,
        now,
      },
    })
    expect(upcoming.getByTestId('kanban-card-due').getAttribute('data-due-state')).toBe('upcoming')
  })

  it('generates assignee avatars from initials and never fetches an image', () => {
    renderCard({
      assignees: [{ id: 'human-wren', name: 'Fictional Human Wren' }],
    })

    const avatar = screen.getByTestId('kanban-card-assignee')
    expect(avatar.textContent).toContain('FW')
    expect(within(avatar).queryByRole('img')).toBeNull()
    expect(avatar.querySelector('img')).toBeNull()
  })

  it('still selects, still drags, and still moves via the labelled lane control', async () => {
    const view = renderCard({ lane: 'ready' })
    const card = screen.getByTestId('kanban-card')
    await fireEvent.click(card)
    expect(view.emitted('select')[0]).toEqual(['fictional-card'])

    const drag = new Event('dragstart', { bubbles: true }) as DragEvent
    Object.defineProperty(drag, 'dataTransfer', {
      value: { setData: () => undefined, effectAllowed: '' },
    })
    card.dispatchEvent(drag)
    expect(card.getAttribute('draggable')).toBe('true')

    await fireEvent.update(screen.getByTestId('kanban-card-move'), 'done')
    expect(view.emitted('move')[0]).toEqual(['fictional-card', 'done'])
  })
})
