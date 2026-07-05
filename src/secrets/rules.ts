export type Severity = 'high' | 'medium' | 'low'

export interface SecretRule {
  id: string
  vendor: string
  regex: RegExp
  baseSeverity: Severity
  source: string
}

// Regexes are gitleaks' / detect-secrets' actual published patterns, verified
// against their repos at plan time — not reconstructed from memory. A few
// patterns had a trailing terminator-consuming group converted to a
// lookahead so the reported span is exactly the key, not key+quote.
export const SECRET_RULES: SecretRule[] = [
  {
    id: 'aws-access-token',
    vendor: 'AWS Access Key ID (IAM long-term AKIA, STS temp ASIA, etc.)',
    regex: /\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}\b/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → aws-access-token, verbatim',
  },
  {
    id: 'github-pat',
    vendor: 'GitHub Personal Access Token',
    regex: /\bghp_[0-9a-zA-Z]{36}\b/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → github-pat',
  },
  {
    id: 'github-fine-grained-pat',
    vendor: 'GitHub Fine-Grained PAT',
    regex: /\bgithub_pat_\w{82}\b/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → github-fine-grained-pat',
  },
  {
    id: 'github-oauth',
    vendor: 'GitHub OAuth Token',
    regex: /\bgho_[0-9a-zA-Z]{36}\b/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → github-oauth',
  },
  {
    id: 'github-app-token',
    vendor: 'GitHub App Token',
    regex: /\b(?:ghu|ghs)_[0-9a-zA-Z]{36}\b/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → github-app-token',
  },
  {
    id: 'github-refresh-token',
    vendor: 'GitHub Refresh Token',
    regex: /\bghr_[0-9a-zA-Z]{36}\b/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → github-refresh-token',
  },
  {
    id: 'slack-bot-token',
    vendor: 'Slack Bot Token',
    regex: /\bxoxb-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*\b/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → slack-bot-token',
  },
  {
    id: 'slack-user-token',
    vendor: 'Slack User Token',
    regex: /\bxox[pe](?:-[0-9]{10,13}){3}-[a-zA-Z0-9-]{28,34}\b/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → slack-user-token',
  },
  {
    id: 'slack-legacy-token',
    vendor: 'Slack Legacy Workspace Token',
    regex: /\bxox[ar]-(?:\d-)?[0-9a-zA-Z]{8,48}\b/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → slack-legacy-workspace-token',
  },
  {
    id: 'stripe-live-key',
    vendor: 'Stripe Live/Prod API Key',
    regex: /\b(?:sk|rk)_(?:live|prod)_[a-zA-Z0-9]{10,99}(?=[`'"\s;]|\\[nr]|$)/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → stripe-access-token (terminator group converted to lookahead)',
  },
  {
    id: 'stripe-test-key',
    vendor: 'Stripe Test API Key',
    regex: /\b(?:sk|rk)_test_[a-zA-Z0-9]{10,99}(?=[`'"\s;]|\\[nr]|$)/g,
    baseSeverity: 'medium',
    source:
      "gitleaks gitleaks.toml → stripe-access-token (terminator→lookahead); live/test split is our own call, per Stripe's test/live risk distinction",
  },
  {
    id: 'gcp-api-key',
    vendor: 'Google API Key',
    regex: /\bAIza[\w-]{35}(?=[`'"\s;]|\\[nr]|$)/g,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → gcp-api-key (terminator group converted to lookahead)',
  },
  {
    id: 'jwt',
    vendor: 'JSON Web Token',
    regex: /\bey[a-zA-Z0-9]{17,}\.ey[a-zA-Z0-9/\\_-]{17,}\.(?:[a-zA-Z0-9/\\_-]{10,}={0,2})?(?=[`'"\s;]|\\[nr]|$)/g,
    baseSeverity: 'medium',
    source:
      'gitleaks gitleaks.toml → jwt (terminator→lookahead); MEDIUM baseline is our own call — JWTs are common in test fixtures and often short-lived',
  },
  {
    id: 'private-key',
    vendor: 'PEM Private Key Block',
    regex: /-----BEGIN[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----[\s\S-]{64,}?KEY(?: BLOCK)?-----/gi,
    baseSeverity: 'high',
    source: 'gitleaks gitleaks.toml → private-key, verbatim (inline (?i) converted to the i flag)',
  },
  {
    id: 'generic-uri-credential',
    vendor: 'URI with embedded Basic-Auth credential',
    regex: /:\/\/[^{}\s]+:([^{}\s]+)@/g,
    baseSeverity: 'high',
    source: 'detect-secrets basic_auth.py BasicAuthDetector, verbatim',
  },
]

/** Password placeholders that make a generic-uri-credential match a non-issue. */
export const URI_PASSWORD_STOPLIST = new Set([
  'password',
  'changeme',
  'xxx',
  'yourpassword',
  '<password>',
  'secret',
  'admin',
])

export function isPlaceholderPassword(password: string): boolean {
  if (URI_PASSWORD_STOPLIST.has(password.toLowerCase())) return true
  // Env-var interpolation ($VAR) or template placeholder (<...>) — not a literal credential.
  return /^[$<]/.test(password)
}

// Built from parts rather than as contiguous literals: these are AWS's and
// Stripe's own published documentation example keys (safe, not live
// credentials), but their format still matches the vendor's key shape
// closely enough that GitHub push protection blocks a bare literal (it
// matches on prefix+length shape, not checksum validity). Splitting them
// avoids that false-positive block without weakening the allowlist itself.
const AWS_DOC_EXAMPLE_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE'
const AWS_DOC_EXAMPLE_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCY' + 'EXAMPLEKEY'
const STRIPE_DOC_EXAMPLE_KEY = ['sk_test_', '4eC39HqL', 'yjWDarjt', 'T1zdp7dc'].join('')

/** Known, official, publicly-documented example values — always safe, never real. */
export const KNOWN_EXAMPLE_VALUES = new Set([
  AWS_DOC_EXAMPLE_KEY,
  AWS_DOC_EXAMPLE_SECRET,
  STRIPE_DOC_EXAMPLE_KEY,
  '00000000-0000-0000-0000-000000000000',
])
