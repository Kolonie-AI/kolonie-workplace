import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const shellStyles = readFileSync(resolve(process.cwd(), 'src/shell/app-shell.css'), 'utf8')

describe('app shell responsive styles', () => {
  /**
   * Until #11 this asserted the sidebar was `display: none` at a narrow
   * viewport. That was written for #6, when the sidebar held nothing to
   * select into and hiding it cost nothing. #11 exercises the core journey at
   * 390×844 and the journey *starts* by choosing a board, so hiding the only
   * control that does so put its first step outside the viewport — which
   * #11's own acceptance criteria forbid.
   *
   * What this test protects is unchanged: at a narrow viewport the shell
   * collapses to a single column so nothing sits beside anything else. The
   * sidebar now stacks above the workspace instead of disappearing.
   */
  it('collapse to a single column at a narrow viewport, sidebar stacked not hidden', () => {
    expect(shellStyles).toMatch(/@media\s*\(max-width:\s*48rem\)/)
    expect(shellStyles).toMatch(/\.app-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
    expect(shellStyles).not.toMatch(/\.app-shell__sidebar\s*\{[^}]*display:\s*none/s)
    expect(shellStyles).toMatch(/\.app-shell__sidebar\s*\{[^}]*grid-row:\s*auto/s)
  })

  it('uses design tokens instead of literal colour values', () => {
    expect(shellStyles).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(shellStyles).toContain('var(--color-accent)')
    expect(shellStyles).toContain('var(--color-canvas)')
  })
})
