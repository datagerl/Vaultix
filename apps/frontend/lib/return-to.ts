/**
 * Resolves the `returnTo` query parameter set by the auth middleware into a
 * safe in-app path. Anything that could leave the origin (absolute URLs,
 * protocol-relative `//host`, backslash tricks) falls back to `fallback`.
 */
export function safeReturnTo(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback;

  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return fallback;
  }

  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }

  return value;
}
