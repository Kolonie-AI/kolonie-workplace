/**
 * The one federated identity the preview lets in, read from the environment and
 * never from a value in this repository.
 *
 * **This is a temporary preview adapter and it has a deletion boundary.** The
 * first cut is *frontend, login and mock data*: the Colony's `humans` table
 * lives in `kolonie-platform` and the workplace has no client for it, because
 * how this SPA proves a human to the API is an open question (`kolonie-docs#506`)
 * that must not be pre-empted by an HTTP call invented here. Until that is
 * decided, a real account signing in through the real hosted login reaches the
 * callback and resolves to nobody, because every identity the fixture directory
 * holds is fictional. This bridges exactly one identity across that gap so the
 * deployed preview can be looked at.
 *
 * It disappears when a real Colony `HumanDirectory` lands: this file, the two
 * variables it names, and the single entry it contributes go together, and
 * nothing else has to be revisited, because nothing else knows it exists.
 *
 * What it deliberately is not:
 *
 * - not a mapping *table* — one pair, one human, and no way to express a second;
 * - not a wildcard, an address match or a first-user-wins rule. Both halves of
 *   `(provider, subject)` must match exactly, so the same subject arriving under
 *   another provider is refused;
 * - not an account store. It resolves to a human the fixture catalogue already
 *   holds and can no more create one than the directory it feeds;
 * - not optional-if-absent. A missing or half-present mapping refuses to build
 *   the directory at all, because the alternative to refusing is broadening what
 *   a login is allowed to match, and that failure would be silent.
 *
 * The provider and the subject are deployment configuration and are never
 * committed. `.env.example` names them and holds no value, exactly as it does
 * for the tenant.
 */
export interface PreviewIdentity {
  readonly provider: string
  readonly subject: string
}

export const PREVIEW_IDENTITY_ENVIRONMENT_VARIABLES = [
  'VITE_PREVIEW_IDENTITY_PROVIDER',
  'VITE_PREVIEW_IDENTITY_SUBJECT',
] as const

/**
 * The refusal names the variables it wants and never what was in them. Echoing
 * a half-configured value back would put an identifier from the login provider
 * into whatever the browser renders or a build log records, which is the failure
 * this whole delivery path exists to avoid.
 */
export class MissingPreviewIdentityConfiguration extends Error {
  readonly missing: readonly string[]

  constructor(missing: readonly string[]) {
    super(
      'Kolonie Workplace: the preview identity mapping is missing or incomplete, ' +
        `so no preview account can be signed in. Set ${missing.join(', ')} in the ` +
        'environment. Both halves are required: a partial mapping is refused ' +
        'rather than matched on the half that is present. The values are ' +
        'deployment configuration and are never committed; .env.example names them.',
    )
    this.name = 'MissingPreviewIdentityConfiguration'
    this.missing = missing
  }
}

function present(
  source: Readonly<Record<string, string | undefined>>,
  name: string,
): string | null {
  const value = source[name]

  if (value === undefined) {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length === 0 ? null : trimmed
}

export function readPreviewIdentity(
  source: Readonly<Record<string, string | undefined>>,
): PreviewIdentity {
  const missing = PREVIEW_IDENTITY_ENVIRONMENT_VARIABLES.filter(
    (name) => present(source, name) === null,
  )

  if (missing.length > 0) {
    throw new MissingPreviewIdentityConfiguration(missing)
  }

  return {
    provider: present(source, 'VITE_PREVIEW_IDENTITY_PROVIDER') as string,
    subject: present(source, 'VITE_PREVIEW_IDENTITY_SUBJECT') as string,
  }
}
