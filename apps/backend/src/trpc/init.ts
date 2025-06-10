import { initTRPC, type inferAsyncReturnType } from '@trpc/server';
import type { Context as HonoContext } from 'hono';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';
import { ZodError } from 'zod';

// Create context for tRPC - updated for Hono adapter
export const createContext = async (opts: FetchCreateContextFnOptions, c: HonoContext) => {
  // Extract user info from headers or session
  const authorization = c.req.header('authorization');
  
  return {
    req: c.req,
    res: c.res,
    user: null, // Will be populated after auth implementation
    authorization,
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

// Middleware for authenticated procedures (to be implemented later)
export const authenticatedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // TODO: Implement authentication check
  if (!ctx.authorization) {
    throw new Error('Unauthorized');
  }
  
  return next({
    ctx: {
      ...ctx,
      // user: authenticatedUser, // Will be implemented with Clerk
    },
  });
});

export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters; 