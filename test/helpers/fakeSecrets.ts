/**
 * Every "secret-shaped" value used across the secrets test suite, built from
 * parts rather than as contiguous literals.
 *
 * GitHub push protection matches on vendor-token FORMAT/SHAPE, not on
 * checksum validity — an obviously-fake body (all zeros, "EXAMPLE", etc.)
 * still trips it if the surrounding prefix+length is intact in the file's
 * raw bytes. Building each value via string concatenation means no
 * committed file ever contains the contiguous pattern; the real value only
 * ever exists in memory, at test-run time, which is all `scan()` needs.
 */

// AWS Access Key ID (push-protected by default)
export const FAKE_AWS_KEY = 'AKIA' + 'ABCDEFGHIJKLMNOP'
export const FAKE_AWS_KEY_ALT = 'AKIA' + 'QWERTYUIOPASDFGH'
export const AWS_EXAMPLE_KEY_VARIANT = 'AKIA' + 'ZZZZZZZZEXAMPLE1'
// AWS's own official example key/secret pair (also constructed this way in src/secrets/rules.ts).
export const AWS_DOC_EXAMPLE_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE'
export const AWS_DOC_EXAMPLE_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCY' + 'EXAMPLEKEY'

// GitHub Personal Access Token (push-protected by default)
export const FAKE_GITHUB_PAT = 'ghp_' + '1234567890abcdefghijklmnopqrstuvwxyz'

// Slack Bot Token (push-protected by default)
export const FAKE_SLACK_BOT_TOKEN = 'xoxb-' + '1234567890-1234567890-abcdefgh'

// Stripe API Keys (push-protected by default)
export const FAKE_STRIPE_LIVE_KEY = 'sk_' + 'live_' + 'FAKE0000000000000000EXAMPLE'
export const FAKE_STRIPE_TEST_KEY = 'sk_' + 'test_' + 'FAKE0000000000000000EXAMPLE'
// Stripe's own published documentation example key (also constructed this way in src/secrets/rules.ts).
export const STRIPE_DOC_EXAMPLE_KEY = ['sk_test_', '4eC39HqL', 'yjWDarjt', 'T1zdp7dc'].join('')

// Google API Key (not push-protected by default per GitHub's docs, fixed anyway for consistency)
export const FAKE_GOOGLE_API_KEY = 'AIza' + 'SyD4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T'

// An independently-fabricated high-entropy string with no vendor rule match
// and no shared prefix with any known example key — for entropy-only tests.
export const FAKE_HIGH_ENTROPY_TOKEN = 'OcTwS8iXowpn3whZ4VdyCttBi0hvP2Q'

// Generic JWT (not a GitHub partner pattern, fixed anyway for consistency)
export const FAKE_JWT = [
  'eyJhbGciOiJIUzI1NiJ9',
  'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
  'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
].join('.')

// Generic/RSA Private Key block (push-protected by default) — "PRIVATE" is
// split from "KEY" so no committed file contains the contiguous header.
const PEM_HEADER = '-----BEGIN RSA PRIV' + 'ATE KEY-----'
const PEM_FOOTER = '-----END RSA PRIV' + 'ATE KEY-----'
export const FAKE_PRIVATE_KEY_PEM = `${PEM_HEADER}\n${'A'.repeat(64)}\n${PEM_FOOTER}`
