import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const shellStyles = readFileSync(resolve(process.cwd(), 'src/shell/app-shell.css'), 'utf8')

describe('app shell responsive styles', () => {
  it('hide the sidebar at a narrow viewport and leave one canvas column', () => {
    expect(shellStyles).toMatch(/@media\s*\(max-width:\s*48rem\)/)
    expect(shellStyles).toMatch(/\.app-shell__sidebar\s*\{[^}]*display:\s*none/s)
    expect(shellStyles).toMatch(/\.app-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s)
  })

  it('uses design tokens instead of literal colour values', () => {
    expect(shellStyles).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(shellStyles).toContain('var(--color-accent)')
    expect(shellStyles).toContain('var(--color-canvas)')
  })
})
