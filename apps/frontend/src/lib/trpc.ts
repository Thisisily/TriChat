import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@trichat/backend/src/trpc/router';

// Create the tRPC client with end-to-end type safety
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3001/trpc',
      transformer: superjson,
      // Add auth headers when available
      headers() {
        return {
          // authorization: `Bearer ${getAuthToken()}`, // Will implement with Clerk
        };
      },
    }),
  ],
});

// Type exports for use throughout the frontend
export type { AppRouter } from '@trichat/backend/src/trpc/router'; 