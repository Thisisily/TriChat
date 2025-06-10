import { z } from 'zod';
import { router, publicProcedure } from '../trpc/init.js';

export const healthRouter = router({
  // Basic health check
  check: publicProcedure
    .query(() => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        service: 'TriChat API',
      };
    }),

  // Health check with custom message
  ping: publicProcedure
    .input(z.object({
      message: z.string().optional().default('pong'),
    }))
    .query(({ input }) => {
      return {
        status: 'ok',
        message: input.message,
        timestamp: new Date().toISOString(),
      };
    }),

  // Server info
  info: publicProcedure
    .query(() => {
      return {
        name: 'TriChat API',
        version: '0.1.0',
        environment: process.env['NODE_ENV'] || 'development',
        runtime: 'Bun',
        framework: 'Hono + tRPC',
        uptime: process.uptime(),
      };
    }),
}); 