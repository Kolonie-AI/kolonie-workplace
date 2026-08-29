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
    coverImageUrl: null,
    coverAttachmentId: null,
    position: 0,
    ...overrides,
  }
}

const FIXED_NOW = new Date('2026-08-27T12:00:00.000Z')

function renderCard(overrides: Partial<WorkItemSummary> = {}, now: Date = FIXED_NOW) {
  return render(KanbanCard, {
    props: {
      item: item(overrides),
      selected: false,
      moving: false,
      now,
    },
  })
}

function denseItem(): Partial<WorkItemSummary> {
  return {
    coverColour: '#1973ff',
    description: '<p>Outline the fictional delivery.</p>',
    labels: [
      { id: 'label-a', title: 'Delivery', colour: '#00db60' },
      { id: 'label-b', title: 'Research', colour: '#8338ec' },
    ],
    assignees: [{ id: 'human-wren', name: 'Fictional Human Wren' }],
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
      {
        id: 'comment-b',
        author: 'Fictional Operator Ember',
        body: 'Another note',
        createdAt: '2026-08-26T12:00:00.000Z',
        updatedAt: '2026-08-26T12:00:00.000Z',
      },
      {
        id: 'comment-c',
        author: 'Fictional Human Wren',
        body: 'A third note',
        createdAt: '2026-08-26T15:00:00.000Z',
        updatedAt: '2026-08-26T15:00:00.000Z',
      },
    ],
    attachments: [{ id: 'file-a', name: 'notes.txt', size: 12, mimeType: 'text/plain' }],
  }
}

describe('KanbanCard — the resting face is title and badges, not a form', () => {
  it('leaves no empty boxes on a card that carries only a title', () => {
    renderCard()

    const card = screen.getByTestId('kanban-card')
    expect(card.textContent).toContain('A fictional card')
    expect(card.textContent).not.toContain('Fictional Agent Quill')
    expect(within(card).queryByTestId('kanban-card-cover')).toBeNull()
    expect(within(card).queryByTestId('kanban-card-label')).toBeNull()
    expect(within(card).queryByTestId('kanban-card-assignee')).toBeNull()
    expect(within(card).queryByTestId('kanban-card-priority')).toBeNull()
    expect(within(card).queryByTestId('kanban-card-due')).toBeNull()
    expect(within(card).queryByTestId('kanban-card-checklist')).toBeNull()
    expect(within(card).queryByTestId('kanban-card-badges')).toBeNull()
    expect(within(card).queryByText('0/0')).toBeNull()
    expect(within(card).queryByLabelText(/checklist/i)).toBeNull()
    expect(within(card).queryByLabelText('Move to lane')).toBeNull()
    expect(within(card).queryByRole('progressbar')).toBeNull()
  })

  it('renders cover, labels, due, checklist, comments, attachment and assignee by accessible name', () => {
    renderCard(denseItem())

    const card = screen.getByTestId('kanban-card')
    expect(within(card).getByTestId('kanban-card-cover')).toBeTruthy()
    expect(within(card).getByRole('img', { name: 'Delivery' })).toBeTruthy()
    expect(within(card).getByRole('img', { name: 'Research' })).toBeTruthy()
    const description = within(card).getByLabelText('Has a description')
    expect(description.textContent).not.toMatch(/Aa/)
    expect(description.querySelector('svg')).not.toBeNull()
    expect(within(card).getByLabelText(/due in 8 days/i)).toBeTruthy()
    expect(within(card).getByLabelText('Checklist 1/2')).toBeTruthy()
    const comments = within(card).getByLabelText('3 comments')
    expect(comments.textContent).toMatch(/3/)
    expect(comments.querySelector('svg')).not.toBeNull()
    const attachments = within(card).getByLabelText('1 attachment')
    expect(attachments.textContent).toMatch(/1/)
    expect(attachments.querySelector('svg')).not.toBeNull()
    expect(within(card).getByLabelText('Fictional Human Wren')).toBeTruthy()
    expect(card.textContent).not.toContain('Fictional Agent Quill')
    expect(within(card).queryByTestId('kanban-card-priority')).toBeNull()
    expect(within(card).queryByRole('progressbar')).toBeNull()
  })

  it('does not show a 0/0 checklist badge when there is no checklist', () => {
    renderCard({ percentDone: 40 })

    expect(screen.queryByText('0/0')).toBeNull()
    expect(screen.queryByLabelText(/checklist/i)).toBeNull()
    expect(screen.queryByTestId('kanban-card-progress')).toBeNull()
  })

  it('shows 0/n when a checklist exists and nothing is done', () => {
    renderCard({
      checklist: [{ id: 'check-a', title: 'One', done: false, position: 0 }],
    })

    expect(screen.getByLabelText('Checklist 0/1')).toBeTruthy()
    expect(screen.getByTestId('kanban-card-checklist').textContent).toMatch(/0\/1/)
  })

  it('paints a colour cover when there is no image, and an image cover when the fixture URL is set', () => {
    const colour = renderCard({ coverColour: '#1973ff' })
    const colourCover = colour.getByTestId('kanban-card-cover')
    expect(colourCover.getAttribute('data-cover-kind')).toBe('colour')
    expect(colourCover.querySelector('img')).toBeNull()
    colour.unmount()

    renderCard({
      coverColour: '#1973ff',
      coverImageUrl: '/fictional-covers/outline.svg',
    })
    const imageCover = screen.getByTestId('kanban-card-cover')
    expect(imageCover.getAttribute('data-cover-kind')).toBe('image')
    expect(imageCover.querySelector('img')?.getAttribute('src')).toBe(
      '/fictional-covers/outline.svg',
    )
  })

  it('names a blocked card and a review card for assistive tech, not only by lane', () => {
    const blocked = renderCard({ lane: 'blocked' })
    expect(blocked.getByTestId('kanban-card').getAttribute('data-blocked')).toBe('true')
    expect(blocked.getByRole('status', { name: 'Blocked' })).toBeTruthy()
    blocked.unmount()

    renderCard({ lane: 'review' })
    expect(screen.getByRole('status', { name: 'Review' })).toBeTruthy()
    expect(screen.queryByRole('status', { name: 'Blocked' })).toBeNull()
  })

  it('is one object: no Move group and no Move-to-lane combobox under the card', () => {
    const { container } = renderCard({ lane: 'ready' })
    const card = screen.getByTestId('kanban-card')
    const shell = container.querySelector('.kanban-card-shell') as HTMLElement

    expect(within(card).queryByLabelText('Move to lane')).toBeNull()
    expect(screen.queryByTestId('kanban-card-move')).toBeNull()
    expect(screen.queryByTestId('kanban-card-move-disclosure')).toBeNull()
    expect(screen.queryByRole('group', { name: /move/i })).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Move to lane' })).toBeNull()
    expect(shell.querySelector('select')).toBeNull()
    expect(shell.querySelector('details')).toBeNull()
    expect(shell.children).toHaveLength(1)
    expect(shell.firstElementChild).toBe(card)
  })

  it('paints a dark label with light text and a light label with dark text', () => {
    renderCard({
      labels: [
        { id: 'dark', title: 'Dark', colour: '#2b2d42' },
        { id: 'light', title: 'Light', colour: '#ffe066' },
      ],
    })

    const dark = screen.getByRole('img', { name: 'Dark' })
    const light = screen.getByRole('img', { name: 'Light' })

    expect(dark.style.color).toBe('var(--color-contrast-light)')
    expect(light.style.color).toBe('var(--color-contrast-dark)')
    expect(dark.style.color).not.toBe(light.style.color)
  })

  it('marks an overdue date from a fixed clock and leaves an upcoming one unmarked', () => {
    const overdue = renderCard({ dueDate: '2026-08-20' })
    expect(overdue.getByTestId('kanban-card-due').getAttribute('data-due-state')).toBe('overdue')
    expect(overdue.getByTestId('kanban-card-due').textContent).toBe('7 days ago')
    overdue.unmount()

    const upcoming = renderCard({ dueDate: '2026-09-04' })
    expect(upcoming.getByTestId('kanban-card-due').getAttribute('data-due-state')).toBe('upcoming')
    expect(upcoming.getByTestId('kanban-card-due').textContent).toBe('in 8 days')
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

  it('still selects and still drags from the face', async () => {
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
  })
})
