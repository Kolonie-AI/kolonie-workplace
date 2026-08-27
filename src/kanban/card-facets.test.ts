import { describe, expect, it } from 'vitest'
import {
  WORK_ITEM_PRIORITY_LABELS,
  checklistProgress,
  dueDateState,
  initialsOf,
  readableTextOn,
} from '@/kanban/card-facets'

describe('card facets — label contrast is computed from the label colour', () => {
  it('puts dark text on a light label and light text on a dark one', () => {
    expect(readableTextOn('#ffe066')).toBe('var(--color-contrast-dark)')
    expect(readableTextOn('#2b2d42')).toBe('var(--color-contrast-light)')
  })

  it('reads a colour whether or not it carries the leading hash', () => {
    expect(readableTextOn('ffe066')).toBe(readableTextOn('#ffe066'))
  })

  it('treats an unusable colour as dark rather than throwing', () => {
    expect(readableTextOn('')).toBe('var(--color-contrast-light)')
    expect(readableTextOn('not-a-colour')).toBe('var(--color-contrast-light)')
  })

  it('separates two colours a naive average would call identical', () => {
    expect(readableTextOn('#00ff00')).toBe('var(--color-contrast-dark)')
    expect(readableTextOn('#0000ff')).toBe('var(--color-contrast-light)')
  })
})

describe('card facets — a due date is judged against a clock that is handed in', () => {
  const now = new Date('2026-08-27T12:00:00.000Z')

  it('calls a past date overdue and a future date upcoming', () => {
    expect(dueDateState('2026-08-20', now)).toBe('overdue')
    expect(dueDateState('2026-09-04', now)).toBe('upcoming')
  })

  it('calls the current day due rather than overdue', () => {
    expect(dueDateState('2026-08-27', now)).toBe('due')
  })

  it('has no state at all for an item without a due date', () => {
    expect(dueDateState(null, now)).toBe(null)
    expect(dueDateState('not-a-date', now)).toBe(null)
  })
})

describe('card facets — checklist progress counts what is done', () => {
  it('summarises done over total', () => {
    expect(
      checklistProgress([
        { id: 'a', title: 'One', done: true, position: 0 },
        { id: 'b', title: 'Two', done: false, position: 1 },
      ]),
    ).toEqual({ done: 1, total: 2 })
  })

  it('reports nothing for an empty checklist', () => {
    expect(checklistProgress([])).toBe(null)
  })
})

describe('card facets — an avatar is initials, never a fetched image', () => {
  it('takes the first letter of the first and last word', () => {
    expect(initialsOf('Fictional Human Wren')).toBe('FW')
    expect(initialsOf('Quill')).toBe('Q')
  })

  it('falls back to a neutral mark rather than an empty circle', () => {
    expect(initialsOf('   ')).toBe('?')
  })
})

describe('card facets — every priority the domain allows has a label', () => {
  it('names all six', () => {
    expect(Object.keys(WORK_ITEM_PRIORITY_LABELS)).toEqual([
      'unset',
      'low',
      'medium',
      'high',
      'urgent',
      'do_now',
    ])
  })
})
