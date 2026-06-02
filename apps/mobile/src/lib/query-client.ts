import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '~/lib/api-client';

// Mirrors the web client's global staleTime so both clients cache identically.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Respect the server's retryability signal: non-retryable ApiErrors
      // (401 NOT_AUTHENTICATED, 400 VALIDATION_FAILED, 404 PROFILE_NOT_FOUND)
      // surface immediately instead of burning 2 extra round-trips — e.g. a
      // 401 after token expiry shouldn't retry-loop before the UI reacts.
      // Network/transport errors (no ApiError) still retry up to twice.
      retry: (failureCount, error) =>
        error instanceof ApiError
          ? error.retryable && failureCount < 2
          : failureCount < 2,
    },
  },
});
