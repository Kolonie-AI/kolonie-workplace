import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

/**
 * Comments name the write path. The rules below are about what the pane
 * does, so they read the code with the comments removed.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
}

const pane = withoutComments(
  readFileSync(resolve(root, 'src/detail/DetailPane.vue'), 'utf8'),
)
const composable = withoutComments(
  readFileSync(resolve(root, 'src/detail/use-item-detail.ts'), 'utf8'),
)
const styles = withoutComments(
  readFileSync(resolve(root, 'src/detail/detail-pane.css'), 'utf8'),
)
const activity = withoutComments(
  readFileSync(resolve(root, 'src/detail/ActivitySection.vue'), 'utf8'),
)

describe('detail source — writes through the parent, never a gateway of its own', () => {
  it('emits an update and never talks to a gateway', () => {
    expect(pane).toMatch(/emit\('update'/)
    expect(pane).not.toMatch(/useTaskGateway|getItemDetail|getBoardItems|updateWorkItem/)
  })

  it('sanitises description markup before it is written', () => {
    expect(pane).toMatch(/sanitizeDescription/)
  })

  it('reuses the same sanitiser for comment HTML and never adds a second one', () => {
    expect(activity).toMatch(/sanitizeDescription/)
    expect(activity).not.toMatch(/DOMPurify|sanitizeHtml|sanitizeComment/)
    expect(activity).toMatch(/Write a comment…/)
  })

  it('judges due dates from the clock that is handed in, never from a Date it constructs', () => {
    expect(pane).toMatch(/relativeDueDate/)
    expect(pane).not.toMatch(/new Date\s*\(/)
  })
})

describe('detail source — the detail is fetched, never taken from the board payload', () => {
  it('loads through the gateway detail call and nothing else', () => {
    expect(composable).toMatch(/gateway\.getItemDetail/)
    expect(composable).not.toMatch(/getBoardItems/)
  })
})

describe('detail source — original Colony code', () => {
  it('names no third-party task model, file, class or asset', () => {
    for (const source of [pane, composable, styles, activity]) {
      expect(source).not.toMatch(/TaskDetailView/i)
      expect(source).not.toMatch(/\bis-(loading|active|done)\b/)
      expect(source).not.toMatch(/\bbucket\b|\btask-id\b|\bITask\b/i)
    }
  })

  it('keeps the Colony owner field beside the assignee list', () => {
    expect(pane).toMatch(/owner/i)
    expect(pane).toMatch(/assignee/i)
  })

  it('opens as a dialog over the board, not a stacked side pane', () => {
    expect(pane).toMatch(/role="dialog"/)
    expect(pane).toMatch(/aria-modal="true"/)
    expect(pane).toMatch(/detail-overlay/)
    expect(pane).toMatch(/in list/)
    expect(pane).toMatch(/Checklist/)
    expect(pane).toMatch(/Attachments/)
    expect(pane).toMatch(/Activity/)
    expect(pane).toMatch(/Add to card/)
  })
})

describe('detail styles', () => {
  it('uses design tokens instead of literal colour values', () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(styles).toContain('var(--color-border)')
    expect(styles).toContain('var(--color-surface)')
  })
})
