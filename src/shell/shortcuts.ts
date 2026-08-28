export interface WorkplaceShortcut {
  readonly key: string
  readonly label: string
}

export const WORKPLACE_SHORTCUTS: readonly WorkplaceShortcut[] = [
  { key: 'f', label: 'Filter cards' },
  { key: '?', label: 'Show keyboard shortcuts' },
]

export function shortcutKeysOf(
  shortcuts: readonly WorkplaceShortcut[] = WORKPLACE_SHORTCUTS,
): readonly string[] {
  return shortcuts.map((shortcut) => shortcut.key)
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tag = target.tagName

  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}
