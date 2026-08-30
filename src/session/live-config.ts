import {
  AUTH0_ENVIRONMENT_VARIABLES,
  MissingAuth0Configuration,
  readAuth0Config,
  type Auth0Config,
} from '@/session/auth0-config'

export const PLATFORM_ORIGIN_VARIABLE = 'VITE_PLATFORM_API_ORIGIN'

export const LIVE_WORKPLACE_VARIABLES = [
  ...AUTH0_ENVIRONMENT_VARIABLES,
  PLATFORM_ORIGIN_VARIABLE,
] as const

export interface LiveWorkplaceConfig extends Auth0Config {
  readonly platformOrigin: string
}

export class MissingLiveWorkplaceConfiguration extends Error {
  readonly missing: readonly string[]

  constructor(missing: readonly string[]) {
    super(
      'Kolonie Workplace: live composition needs Auth0 and the Colony origin. ' +
        `Set ${missing.join(', ')} in the environment. ` +
        'The values are deployment configuration and are never committed; ' +
        '.env.example names them. With every live variable absent, the fixture ' +
        'preview session is used instead.',
    )
    this.name = 'MissingLiveWorkplaceConfiguration'
    this.missing = missing
  }
}

function present(source: Readonly<Record<string, string | undefined>>, name: string): string | null {
  const value = source[name]

  if (value === undefined) {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length === 0 ? null : trimmed
}

export function missingLiveWorkplaceVariables(
  source: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  return LIVE_WORKPLACE_VARIABLES.filter((name) => present(source, name) === null)
}

export function isLiveWorkplaceConfigured(
  source: Readonly<Record<string, string | undefined>>,
): boolean {
  return missingLiveWorkplaceVariables(source).length === 0
}

export function isWorkplaceConfigAbsent(
  source: Readonly<Record<string, string | undefined>>,
): boolean {
  return missingLiveWorkplaceVariables(source).length === LIVE_WORKPLACE_VARIABLES.length
}

export function readLiveWorkplaceConfig(
  source: Readonly<Record<string, string | undefined>>,
): LiveWorkplaceConfig {
  const missing = missingLiveWorkplaceVariables(source)

  if (missing.length > 0) {
    if (missing.includes(PLATFORM_ORIGIN_VARIABLE) === false) {
      try {
        readAuth0Config(source)
      } catch (error) {
        if (error instanceof MissingAuth0Configuration) {
          throw new MissingLiveWorkplaceConfiguration([...error.missing, ...missing])
        }
      }
    }

    throw new MissingLiveWorkplaceConfiguration(missing)
  }

  const auth0 = readAuth0Config(source)

  return {
    ...auth0,
    platformOrigin: present(source, PLATFORM_ORIGIN_VARIABLE) as string,
  }
}
