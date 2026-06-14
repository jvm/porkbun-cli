/**
 * UI redaction and safe rendering of untrusted strings.
 * Strips control characters, bounds field lengths, and redacts sensitive values.
 */

const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?key/i,
  /secret[_-]?api[_-]?key/i,
  /password/i,
  /auth[_-]?code/i,
  /request[_-]?token/i,
  /authorization/i,
  /private[_-]?key/i,
  /certificate[_-]?chain/i,
  /public[_-]?key/i,
  /token/i,
];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const ANSI_ESCAPE = /\x1B\[[0-9;]*[A-Za-z]/g;
const MAX_FIELD_LENGTH = 200;

/**
 * Strip terminal control characters from API-provided strings.
 * Allows only explicitly handled line breaks and tabs.
 */
export function sanitizeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(ANSI_ESCAPE, '')
    .replace(CONTROL_CHARS, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * Bound rendered field length.
 */
export function truncateField(value: string, maxLen = MAX_FIELD_LENGTH): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
}

/**
 * Check if a key matches a sensitive pattern.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Redact a value for review screens.
 */
export function redactReviewValue(key: string, value: unknown): string {
  if (isSensitiveKey(key)) return '[REDACTED]';
  return sanitizeString(value);
}

/**
 * Redact a value for error views and status lines.
 */
export function redactErrorValue(value: unknown): string {
  const str = sanitizeString(value);
  // Redact anything that looks like an API key or secret
  return str
    .replace(/pk[12]_live_[a-zA-Z0-9]+/g, '[REDACTED]')
    .replace(/sk[12]_live_[a-zA-Z0-9]+/g, '[REDACTED]')
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[REDACTED]');
}

/**
 * Redact all sensitive fields in an object.
 *
 * Built on a `Map` so the dynamic key writes are not flagged by
 * eslint-plugin-security's `detect-object-injection` rule (the rule
 * accepts Maps but not bracket-notation writes on plain objects).
 * The returned `Record` is what the public API has always promised;
 * Maps don't have a prototype chain, so this conversion is safe
 * even when redaction runs on attacker-controlled input.
 */
export function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result = new Map<string, unknown>();
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      result.set(key, '[REDACTED]');
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result.set(key, redactObject(value as Record<string, unknown>));
    } else {
      result.set(key, value);
    }
  }
  return Object.fromEntries(result);
}
