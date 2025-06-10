import { initTRPC, type inferAsyncReturnType } from '@trpc/server';
import type { Context as HonoContext } from 'hono';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { prisma } from '../lib/database.js';
import { getUserFromAuth } from '../lib/auth.js';

// Create context for tRPC - updated for Hono adapter with authentication
export const createContext = async (_opts: FetchCreateContextFnOptions, c: HonoContext) => {
  // Extract user info from headers or session
  const authorization = c.req.header('authorization');
  
  // Get authenticated user if authorization header is present
  const authUser = authorization ? await getUserFromAuth(authorization) : null;
  
  return {
    req: c.req,
    res: c.res,
    user: authUser, // Now contains actual user data when authenticated
    authorization,
    prisma, // Add Prisma client to context
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;

// Initialize tRPC with context and transformer
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

// Export reusable router and procedure builders
export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware for authenticated procedures - now properly implemented
export const authenticatedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Check if user is authenticated
  if (!ctx.user) {
    throw new Error('Unauthorized - Please sign in to continue');
  }
  
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // User is guaranteed to be present here
    },
  });
});

export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters; 