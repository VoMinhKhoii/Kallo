import 'server-only';

/**
 * Parse ADMIN_EMAILS on demand so tests can safely mutate process.env.
 */
export function getAdminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}
