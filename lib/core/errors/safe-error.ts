/** `name` of the sanitized error `safeError` builds; the Sentry scrubber keys on it. */
export const DATABASE_QUERY_ERROR_NAME = 'DatabaseQueryError';

/** The `at …` frame lines of a stack, without its header. */
export function stackFrames(stack: string): string {
  return stack
    .split('\n')
    .filter((line) => /^\s+at /.test(line))
    .join('\n');
}

/** Drizzle appends every bound value to its message, including private data. */
export function stripQueryParams(message: string): string {
  const marker = message.indexOf('\nparams:');
  return marker < 0 ? message : message.slice(0, marker);
}

function databaseError(error: unknown): Error | undefined {
  const seen = new Set<Error>();
  let messageOnly: Error | undefined;
  while (error instanceof Error && !seen.has(error)) {
    seen.add(error);
    if (
      ('query' in error && 'params' in error) ||
      error.name === 'PostgresError'
    )
      return error;
    if (error.message.includes('\nparams:')) messageOnly = error;
    error = error.cause;
  }
  return messageOnly;
}

/** Only stable SQLSTATE / driver codes, never driver messages or row details. */
function driverCode(error: unknown): string | undefined {
  const seen = new Set<Error>();
  while (error instanceof Error && !seen.has(error)) {
    seen.add(error);
    if (
      'code' in error &&
      typeof error.code === 'string' &&
      /^[A-Z0-9_]{1,64}$/.test(error.code)
    ) {
      return error.code;
    }
    error = error.cause;
  }
  return undefined;
}

/**
 * Safe for stdout and Sentry: DB failures retain SQL + code + frames only.
 * Never copy params, driver causes/details, or the original stack header.
 * Ordinary errors keep their identity and existing reporting behavior.
 */
export function safeError(error: unknown): unknown {
  const dbError = databaseError(error);
  if (!dbError)
    return typeof error === 'string' ? stripQueryParams(error) : error;
  const code = driverCode(dbError);
  const query =
    'query' in dbError && typeof dbError.query === 'string'
      ? `Failed query: ${dbError.query}`
      : dbError.message.includes('\nparams:')
        ? stripQueryParams(dbError.message)
        : 'Database request failed';
  const safe = new Error(
    `${stripQueryParams(query)}${code ? ` [${code}]` : ''}`
  );
  safe.name = DATABASE_QUERY_ERROR_NAME;
  // Remove the whole message first: a bound multiline value may itself
  // contain text shaped like a stack frame.
  const header = `${dbError.name}: ${dbError.message}`;
  const frames = stackFrames(
    dbError.stack?.startsWith(header) ? dbError.stack.slice(header.length) : ''
  );
  safe.stack = `${safe.name}: ${safe.message}${frames ? `\n${frames}` : ''}`;
  return safe;
}
