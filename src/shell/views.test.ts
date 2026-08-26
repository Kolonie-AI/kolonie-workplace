import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKPLACE_VIEW,
  WORKPLACE_VIEWS,
  WORKPLACE_VIEW_LABELS,
  isWorkplaceView,
  resolveWorkplaceView,
} from '@/shell/views'

describe('workplace views', () => {
  it('are exactly two, in tab order', () => {
    expect(WORKPLACE_VIEWS).toEqual(['kanban', 'list'])
  })

  it('carries a human label for each view and for nothing else', () => {
    expect(Object.keys(WORKPLACE_VIEW_LABELS)).toEqual(['kanban', 'list'])
    expect(WORKPLACE_VIEW_LABELS.kanban).toBe('Kanban')
    expect(WORKPLACE_VIEW_LABELS.list).toBe('List')
  })

  it('opens on Kanban', () => {
    expect(DEFAULT_WORKPLACE_VIEW).toBe('kanban')
  })

  it('recognises the two views it defines', () => {
    expect(isWorkplaceView('kanban')).toBe(true)
    expect(isWorkplaceView('list')).toBe(true)
  })
})

describe('workplace views — rejection: a view the workplace does not define', () => {
  it('refuses views Vikunja has and this workplace does not', () => {
    expect(isWorkplaceView('table')).toBe(false)
    expect(isWorkplaceView('gantt')).toBe(false)
  })

  it('refuses an empty, mis-cased or whitespace name rather than guessing', () => {
    expect(isWorkplaceView('')).toBe(false)
    expect(isWorkplaceView('Kanban')).toBe(false)
    expect(isWorkplaceView(' kanban ')).toBe(false)
  })

  it('falls back to Kanban rather than returning an unknown view', () => {
    expect(resolveWorkplaceView('gantt')).toBe('kanban')
    expect(resolveWorkplaceView('table')).toBe('kanban')
    expect(resolveWorkplaceView('')).toBe('kanban')
  })

  it('falls back to Kanban when nothing was requested at all', () => {
    expect(resolveWorkplaceView(undefined)).toBe('kanban')
    expect(resolveWorkplaceView(null)).toBe('kanban')
  })

  it('still returns a requested view that the workplace does define', () => {
    expect(resolveWorkplaceView('list')).toBe('list')
    expect(resolveWorkplaceView('kanban')).toBe('kanban')
  })
})
