import { afterEach, describe, expect, it } from 'vitest'
import { mountWorkplace } from '@/mount'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('mountWorkplace — the app mounts', () => {
  it('renders the workplace shell into the mount target', () => {
    document.body.innerHTML = '<div id="app"></div>'

    mountWorkplace('#app')

    const target = document.querySelector('#app')
    expect(target?.querySelector('h1')?.textContent?.trim()).toBe('Work board')
    expect(target?.querySelector('[data-testid="sidebar"]')).not.toBeNull()
    expect(target?.querySelector('[role="tabpanel"]')).not.toBeNull()
  })

  it('hands back an app that can be unmounted, leaving the target empty', () => {
    document.body.innerHTML = '<div id="app"></div>'

    mountWorkplace('#app').unmount()

    expect(document.querySelector('#app')?.innerHTML).toBe('')
  })
})

describe('mountWorkplace — rejection: the mount target is missing', () => {
  it('throws instead of mounting nowhere when the selector matches no element', () => {
    document.body.innerHTML = '<div id="not-the-app"></div>'

    expect(() => mountWorkplace('#app')).toThrowError(/mount target "#app" was not found/)
  })

  it('leaves the document untouched when the mount target is missing', () => {
    document.body.innerHTML = '<div id="not-the-app"></div>'

    expect(() => mountWorkplace('#app')).toThrow()
    expect(document.body.innerHTML).toBe('<div id="not-the-app"></div>')
    expect(document.querySelector('h1')).toBeNull()
  })
})
