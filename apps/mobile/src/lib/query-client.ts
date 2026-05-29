import { QueryClient } from '@tanstack/react-query';

// Mirrors the web client's global staleTime so both clients cache identically.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
    },
  },
});
