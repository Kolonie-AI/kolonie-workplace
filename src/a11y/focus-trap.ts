const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusableInside(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (node) => node.getAttribute('aria-hidden') !== 'true',
  )
}

export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') {
    return
  }

  const nodes = focusableInside(container)

  if (nodes.length === 0) {
    event.preventDefault()
    container.focus()
    return
  }

  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement

  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault()
    last?.focus()
    return
  }

  if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault()
    first?.focus()
  }
}
