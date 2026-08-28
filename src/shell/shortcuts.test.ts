import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WORKPLACE_SHORTCUTS, shortcutKeysOf } from '@/shell/shortcuts'

const overlaySource = readFileSync(resolve(process.cwd(), 'src/shell/AppShell.vue'), 'utf8')
const shortcutSource = readFileSync(resolve(process.cwd(), 'src/shell/shortcuts.ts'), 'utf8')

describe('workplace shortcuts — documented set is the registered set', () => {
  it('registers each shortcut once, with a key and a label', () => {
    const keys = shortcutKeysOf()

    expect(keys).toEqual(['f', '?'])
    expect(new Set(keys).size).toBe(keys.length)
    for (const shortcut of WORKPLACE_SHORTCUTS) {
      expect(shortcut.key.length).toBeGreaterThan(0)
      expect(shortcut.label.length).toBeGreaterThan(0)
    }
  })

  it('renders the overlay from WORKPLACE_SHORTCUTS rather than a second list', () => {
    expect(overlaySource).toMatch(/v-for="shortcut in WORKPLACE_SHORTCUTS"/)
    expect(overlaySource).not.toMatch(/Show keyboard shortcuts[\s\S]*Filter cards F/)
    expect(shortcutSource).toMatch(/key: 'f'/)
    expect(shortcutSource).toMatch(/key: '\?'/)
  })

  it('fails if a shortcut is documented but not registered, or the reverse', () => {
    const documented = [...overlaySource.matchAll(/shortcut\.key/g)]
    const registered = shortcutKeysOf()

    expect(documented.length).toBeGreaterThan(0)
    expect(registered).toEqual(['f', '?'])
    expect(overlaySource).toContain('WORKPLACE_SHORTCUTS')
    expect(overlaySource).not.toMatch(/key:\s*'g'/)
  })
})
