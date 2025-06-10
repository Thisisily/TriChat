import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../backend/src/app';
import { getSessionToken } from './stores/auth';
import superjson from 'superjson';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create the tRPC client with end-to-end type safety
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/trpc`,
      transformer: superjson,
      async headers() {
        // Get session token for authenticated requests
        const token = await getSessionToken();
        
        return {
          ...(token && { authorization: `Bearer ${token}` }),
          'content-type': 'application/json',
        };
      },
    }),
  ],
});

// Export types for use in components
export type { AppRouter } from '../../../backend/src/app'; 