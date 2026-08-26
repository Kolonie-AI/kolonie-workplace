import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

describe('workplace design tokens', () => {
  it('defines its colour, spacing, radius and type scales once', () => {
    expect(tokens).toContain('--color-accent:')
    expect(tokens).toContain('--color-canvas:')
    expect(tokens).toContain('--space-1:')
    expect(tokens).toContain('--radius-medium:')
    expect(tokens).toContain('--text-small:')
  })

  it('keeps literal colours inside the token file', () => {
    const literals = tokens.match(/#[0-9a-fA-F]{3,8}/g) ?? []

    expect(literals.length).toBeGreaterThan(0)
  })
})
