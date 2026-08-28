/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Relative-luminance contrast against black or white, guaranteeing a readable
 * foreground on a label chip. Relative due dates are computed from a clock
 * that is handed in, never from a Date constructed here.
 */

import type { ChecklistItem, WorkItemPriority } from '@/domain/workplace'

export type DueDateState = 'overdue' | 'due' | 'upcoming'

export const WORK_ITEM_PRIORITIES = [
  'unset',
  'low',
  'medium',
  'high',
  'urgent',
  'do_now',
] as const satisfies readonly WorkItemPriority[]

export const WORK_ITEM_PRIORITY_LABELS: Record<WorkItemPriority, string> = {
  unset: 'Unset',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
  do_now: 'Do now',
}

const CONTRAST_DARK = 'var(--color-contrast-dark)'
const CONTRAST_LIGHT = 'var(--color-contrast-light)'

function parseHexColour(colour: string): { r: number; g: number; b: number } | null {
  const hex = colour.startsWith('#') ? colour.slice(1) : colour

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null
  }

  const rgb = Number.parseInt(hex, 16)

  return {
    r: (rgb >> 16) & 0xff,
    g: (rgb >> 8) & 0xff,
    b: rgb & 0xff,
  }
}

function toLinear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
}

/**
 * Relative luminance of a hex colour, then the foreground whose contrast
 * against it is the larger of black or white. The flip point is the luminance
 * where those two contrasts are equal (sqrt(1.05 * 0.05) - 0.05 ≈ 0.1791).
 */
export function readableTextOn(colour: string): string {
  const rgb = parseHexColour(colour)

  if (rgb === null) {
    return CONTRAST_LIGHT
  }

  const luminance =
    0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b)

  return luminance > 0.1791 ? CONTRAST_DARK : CONTRAST_LIGHT
}

export function dueDateState(dueDate: string | null, now: Date): DueDateState | null {
  if (dueDate === null || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return null
  }

  const today = now.toISOString().slice(0, 10)

  if (dueDate < today) {
    return 'overdue'
  }

  if (dueDate === today) {
    return 'due'
  }

  return 'upcoming'
}

export function relativeDueDate(dueDate: string | null, now: Date): string | null {
  if (dueDate === null || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return null
  }

  const today = now.toISOString().slice(0, 10)
  const dueMs = Date.parse(`${dueDate}T00:00:00.000Z`)
  const todayMs = Date.parse(`${today}T00:00:00.000Z`)
  const days = Math.round((dueMs - todayMs) / 86_400_000)

  if (days === 0) {
    return 'today'
  }

  if (days === 1) {
    return 'in 1 day'
  }

  if (days === -1) {
    return '1 day ago'
  }

  if (days > 1) {
    return `in ${days} days`
  }

  return `${-days} days ago`
}

export function isWorkItemPriority(value: string): value is WorkItemPriority {
  return (WORK_ITEM_PRIORITIES as readonly string[]).includes(value)
}

export function checklistProgress(
  checklist: readonly ChecklistItem[],
): { done: number; total: number } | null {
  if (checklist.length === 0) {
    return null
  }

  return {
    done: checklist.filter((entry) => entry.done).length,
    total: checklist.length,
  }
}

export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)

  if (words.length === 0) {
    return '?'
  }

  const first = words[0]?.[0]
  const last = words.length > 1 ? words[words.length - 1]?.[0] : undefined

  if (first === undefined) {
    return '?'
  }

  return (last === undefined ? first : `${first}${last}`).toUpperCase()
}
