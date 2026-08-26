import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

/**
 * The prose in these files explains why there is no edit control and no
 * comment box, so it necessarily contains those words. The rules below are
 * about what the pane does, so they read the code with the comments removed.
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

describe('detail source — read-only by construction', () => {
  it('renders no form control of any kind', () => {
    expect(pane).not.toMatch(/<form|<input|<textarea|<select/i)
    expect(pane).not.toMatch(/v-model/)
    expect(pane).not.toMatch(/contenteditable/i)
  })

  it('emits nothing that could write, comment or change a status', () => {
    expect(pane).not.toMatch(
      /emit\(\s*['"](update|save|create|delete|comment|assign|move|status)/i,
    )
  })

  it('reaches no gateway of its own — the detail arrives as a prop', () => {
    expect(pane).not.toMatch(/useTaskGateway|getItemDetail|getBoardItems/)
  })
})

describe('detail source — the detail is fetched, never taken from the board payload', () => {
  it('loads through the gateway detail call and nothing else', () => {
    expect(composable).toMatch(/gateway\.getItemDetail/)
    expect(composable).not.toMatch(/getBoardItems/)
  })
})

describe('detail source — original code, not a Vikunja port', () => {
  it('names no Vikunja module, file, class or asset', () => {
    for (const source of [pane, composable, styles]) {
      expect(source).not.toMatch(/vikunja/i)
      expect(source).not.toMatch(/TaskDetailView/i)
      expect(source).not.toMatch(/\bis-(loading|active|done)\b/)
      expect(source).not.toMatch(/\bbucket\b|\btask-id\b|\bITask\b/i)
    }
  })

  it('speaks of one accountable owner rather than a list of assignees', () => {
    expect(pane).toMatch(/owner/i)
    expect(pane).not.toMatch(/assignee/i)
  })
})

describe('detail styles', () => {
  it('uses design tokens instead of literal colour values', () => {
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(styles).toContain('var(--color-border)')
    expect(styles).toContain('var(--color-surface)')
  })
})
