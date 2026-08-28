import { describe, expect, it } from 'vitest'
import { trapFocus } from '@/a11y/focus-trap'

function dialogWith(controls: number): HTMLElement {
  const root = document.createElement('div')
  root.setAttribute('role', 'dialog')
  root.tabIndex = -1
  document.body.append(root)

  for (let index = 0; index < controls; index += 1) {
    const button = document.createElement('button')
    button.textContent = `Control ${index + 1}`
    root.append(button)
  }

  return root
}

describe('focus trap', () => {
  it('wraps Tab from the last control to the first', () => {
    const root = dialogWith(2)
    const [first, last] = [...root.querySelectorAll('button')]
    last?.focus()

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    trapFocus(root, event)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    root.remove()
  })

  it('wraps Shift+Tab from the first control to the last', () => {
    const root = dialogWith(2)
    const [first, last] = [...root.querySelectorAll('button')]
    first?.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    trapFocus(root, event)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
    root.remove()
  })
})
