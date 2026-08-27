import { describe, expect, it } from 'vitest'
import {
  MissingPreviewIdentityConfiguration,
  PREVIEW_IDENTITY_ENVIRONMENT_VARIABLES,
  readPreviewIdentity,
} from '@/session/preview-identity'

const COMPLETE = {
  VITE_PREVIEW_IDENTITY_PROVIDER: 'configured-provider',
  VITE_PREVIEW_IDENTITY_SUBJECT: 'configured-subject',
} as const

describe('the preview identity is read from the environment', () => {
  it('reads the provider and the subject', () => {
    expect(readPreviewIdentity(COMPLETE)).toEqual({
      provider: 'configured-provider',
      subject: 'configured-subject',
    })
  })

  it('trims surrounding whitespace an env file or a secret file easily carries', () => {
    const identity = readPreviewIdentity({
      VITE_PREVIEW_IDENTITY_PROVIDER: '  configured-provider  ',
      VITE_PREVIEW_IDENTITY_SUBJECT: 'configured-subject\n',
    })

    expect(identity.provider).toBe('configured-provider')
    expect(identity.subject).toBe('configured-subject')
  })

  it('names both variables it requires', () => {
    expect(PREVIEW_IDENTITY_ENVIRONMENT_VARIABLES).toEqual([
      'VITE_PREVIEW_IDENTITY_PROVIDER',
      'VITE_PREVIEW_IDENTITY_SUBJECT',
    ])
  })
})

describe('rejection: a missing or partial preview mapping refuses rather than broadening access', () => {
  it('refuses when the mapping is absent entirely', () => {
    expect(() => readPreviewIdentity({})).toThrow(MissingPreviewIdentityConfiguration)
  })

  it.each([
    'VITE_PREVIEW_IDENTITY_PROVIDER',
    'VITE_PREVIEW_IDENTITY_SUBJECT',
  ])('refuses a partial mapping missing %s, and names it', (missing) => {
    const partial: Record<string, string> = { ...COMPLETE }
    delete partial[missing]

    expect(() => readPreviewIdentity(partial)).toThrow(MissingPreviewIdentityConfiguration)

    try {
      readPreviewIdentity(partial)
    } catch (error) {
      expect((error as Error).message).toContain(missing)
    }
  })

  it('treats an empty or whitespace value as absent, so half a pair never half-matches', () => {
    expect(() =>
      readPreviewIdentity({ ...COMPLETE, VITE_PREVIEW_IDENTITY_SUBJECT: '' }),
    ).toThrow(MissingPreviewIdentityConfiguration)
    expect(() =>
      readPreviewIdentity({ ...COMPLETE, VITE_PREVIEW_IDENTITY_PROVIDER: '   ' }),
    ).toThrow(MissingPreviewIdentityConfiguration)
  })

  it('names every missing variable at once rather than one per attempt', () => {
    try {
      readPreviewIdentity({})
      throw new Error('expected a refusal')
    } catch (error) {
      const message = (error as Error).message

      expect(message).toContain('VITE_PREVIEW_IDENTITY_PROVIDER')
      expect(message).toContain('VITE_PREVIEW_IDENTITY_SUBJECT')
    }
  })

  it('never invents a provider or a subject of its own', () => {
    const refusal = (() => {
      try {
        readPreviewIdentity({})
        return ''
      } catch (error) {
        return (error as Error).message
      }
    })()

    expect(refusal).not.toMatch(/google|github|password|auth0\|/i)
    expect(refusal).not.toMatch(/\bsub\b\s*[:=]/i)
  })
})
