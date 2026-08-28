import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

function declarations(source: string): Map<string, string> {
  const tokens = new Map<string, string>()

  for (const match of source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1]
    const value = match[2]
    if (name === undefined || value === undefined) {
      continue
    }
    tokens.set(name, value.trim())
  }

  return tokens
}

function schemeBlock(source: string, scheme: 'light' | 'dark'): string {
  const marker = `[data-color-scheme="${scheme}"]`
  const start = source.indexOf(marker)
  const openingBrace = source.indexOf('{', start)
  const end = source.indexOf('\n}', openingBrace)

  return source.slice(openingBrace + 1, end)
}

describe('workplace design tokens', () => {
  it('defines complete colour, spacing, radius, shadow, type and motion scales', () => {
    for (const token of [
      '--color-accent',
      '--color-canvas',
      '--space-1',
      '--space-8',
      '--radius-small',
      '--radius-pill',
      '--shadow-small',
      '--shadow-large',
      '--text-caption',
      '--text-display',
      '--motion-fast',
      '--motion-slow',
    ]) {
      expect(tokens).toContain(`${token}:`)
    }
  })

  it('defines every theme token in both the light and dark schemes', () => {
    const light = declarations(schemeBlock(tokens, 'light'))
    const dark = declarations(schemeBlock(tokens, 'dark'))

    expect([...dark.keys()].sort()).toEqual([...light.keys()].sort())
  })

  it('activates the dark scheme from the operating-system preference', () => {
    expect(tokens).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)[\s\S]*:root:not\(\[data-color-scheme="light"\]\)/,
    )
  })

  it('keeps literal colours inside the token file', () => {
    const hex = tokens.match(/#[0-9a-fA-F]{3,8}/g) ?? []
    const hsl = tokens.match(/\bhsla?\(/g) ?? []

    expect(hex.length + hsl.length).toBeGreaterThan(0)
  })

  it('forbids raw hex colours in every component stylesheet', async () => {
    const { globSync } = await import('node:fs')
    const files = (globSync('src/**/*.css', { cwd: process.cwd() }) as string[]).filter(
      (path) => path !== 'src/styles/tokens.css',
    )

    expect(files.length).toBeGreaterThan(0)

    for (const path of files) {
      const sheet = readFileSync(resolve(process.cwd(), path), 'utf8')

      expect(sheet, path).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    }
  })
})
