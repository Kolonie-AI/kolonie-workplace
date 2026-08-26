import { describe, expect, it } from 'vitest'
import { readAuth0Config, MissingAuth0Configuration } from '@/session/auth0-config'

const COMPLETE = {
  VITE_AUTH0_DOMAIN: 'configured-domain',
  VITE_AUTH0_CLIENT_ID: 'configured-client-id',
  VITE_AUTH0_CALLBACK: 'configured-callback',
} as const

describe('Auth0 configuration comes from the environment', () => {
  it('reads the domain, the client id and the callback', () => {
    const config = readAuth0Config(COMPLETE)

    expect(config).toEqual({
      domain: 'configured-domain',
      clientId: 'configured-client-id',
      callback: 'configured-callback',
    })
  })

  it('trims surrounding whitespace an env file easily carries', () => {
    const config = readAuth0Config({
      VITE_AUTH0_DOMAIN: '  configured-domain  ',
      VITE_AUTH0_CLIENT_ID: 'configured-client-id\n',
      VITE_AUTH0_CALLBACK: ' configured-callback ',
    })

    expect(config.domain).toBe('configured-domain')
    expect(config.clientId).toBe('configured-client-id')
    expect(config.callback).toBe('configured-callback')
  })
})

describe('Auth0 configuration fails loudly rather than falling back', () => {
  it.each([
    'VITE_AUTH0_DOMAIN',
    'VITE_AUTH0_CLIENT_ID',
    'VITE_AUTH0_CALLBACK',
  ])('refuses when %s is absent, and names it', (missing) => {
    const partial: Record<string, string> = { ...COMPLETE }
    delete partial[missing]

    expect(() => readAuth0Config(partial)).toThrow(MissingAuth0Configuration)

    try {
      readAuth0Config(partial)
    } catch (error) {
      expect((error as Error).message).toContain(missing)
    }
  })

  it('treats an empty or whitespace value as absent', () => {
    expect(() => readAuth0Config({ ...COMPLETE, VITE_AUTH0_CLIENT_ID: '' })).toThrow(
      MissingAuth0Configuration,
    )
    expect(() => readAuth0Config({ ...COMPLETE, VITE_AUTH0_DOMAIN: '   ' })).toThrow(
      MissingAuth0Configuration,
    )
  })

  it('names every missing variable at once rather than one per attempt', () => {
    try {
      readAuth0Config({})
      throw new Error('expected a refusal')
    } catch (error) {
      const message = (error as Error).message
      expect(message).toContain('VITE_AUTH0_DOMAIN')
      expect(message).toContain('VITE_AUTH0_CLIENT_ID')
      expect(message).toContain('VITE_AUTH0_CALLBACK')
    }
  })

  it('never invents a tenant, a client or a callback of its own', () => {
    const refusal = (() => {
      try {
        readAuth0Config({})
        return ''
      } catch (error) {
        return (error as Error).message
      }
    })()

    expect(refusal).not.toMatch(/https?:\/\/(?!.*\bexample\b)/)
    expect(refusal).not.toMatch(/\.auth0\.com/)
    expect(refusal).not.toMatch(/localhost/)
  })
})
