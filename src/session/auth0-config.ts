/**
 * Tenant configuration is read from the environment and never from a value in
 * this repository. The tenant host name, the client id and the callback are
 * deployment configuration: a public PKCE client id is not a secret, but it
 * still identifies one tenant's application, and `AGENTS.md` §3 keeps host
 * names out of the tree regardless.
 *
 * There is deliberately no default and no fallback. An application that
 * silently signed people in against a built-in tenant, or that quietly reverted
 * to a fixture picker when configuration was missing, would be worse than one
 * that refuses to start: the failure would be invisible until someone was
 * signed in as the wrong person.
 */
export interface Auth0Config {
  readonly domain: string
  readonly clientId: string
  readonly callback: string
}

export const AUTH0_ENVIRONMENT_VARIABLES = [
  'VITE_AUTH0_DOMAIN',
  'VITE_AUTH0_CLIENT_ID',
  'VITE_AUTH0_CALLBACK',
] as const

export class MissingAuth0Configuration extends Error {
  readonly missing: readonly string[]

  constructor(missing: readonly string[]) {
    super(
      'Kolonie Workplace: the workplace cannot sign anybody in because its Auth0 ' +
        `configuration is missing. Set ${missing.join(', ')} in the environment. ` +
        'The values are deployment configuration and are never committed; ' +
        '.env.example names them.',
    )
    this.name = 'MissingAuth0Configuration'
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

export function readAuth0Config(
  source: Readonly<Record<string, string | undefined>>,
): Auth0Config {
  const missing = AUTH0_ENVIRONMENT_VARIABLES.filter(
    (name) => present(source, name) === null,
  )

  if (missing.length > 0) {
    throw new MissingAuth0Configuration(missing)
  }

  return {
    domain: present(source, 'VITE_AUTH0_DOMAIN') as string,
    clientId: present(source, 'VITE_AUTH0_CLIENT_ID') as string,
    callback: present(source, 'VITE_AUTH0_CALLBACK') as string,
  }
}
