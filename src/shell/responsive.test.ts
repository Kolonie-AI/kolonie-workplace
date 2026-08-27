import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const shellStyles = readFileSync(resolve(process.cwd(), 'src/shell/app-shell.css'), 'utf8')

describe('app shell responsive styles', () => {
  it('makes the narrow sidebar an overlay controlled by the menu button', () => {
    expect(shellStyles).toMatch(/@media\s*\(max-width:\s*48rem\)/)
    expect(shellStyles).toMatch(
      /\.app-shell__menu-button\s*\{[^}]*display:\s*inline-grid/s,
    )
    expect(shellStyles).toMatch(
      /\.app-shell__sidebar\s*\{[^}]*position:\s*fixed[^}]*transform:\s*translateX\(-100%\)/s,
    )
    expect(shellStyles).toMatch(
      /\.app-shell\[data-mobile-menu-open="true"\]\s+\.app-shell__sidebar\s*\{[^}]*transform:\s*translateX\(0\)/s,
    )
  })

  it('keeps the mobile menu button out of the desktop layout', () => {
    expect(shellStyles).toMatch(
      /\.app-shell__menu-button\s*\{[^}]*display:\s*none/s,
    )
  })

  it('uses design tokens instead of literal colour values', () => {
    expect(shellStyles).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(shellStyles).toContain('var(--color-accent)')
    expect(shellStyles).toContain('var(--color-canvas)')
  })
})
