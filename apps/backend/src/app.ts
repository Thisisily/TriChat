import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createContext } from './trpc/init.js';
import { appRouter } from './trpc/router.js';
import { streamingRouter } from './routes/streaming.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));

// Streaming routes (WebSocket & SSE)
app.route('/stream', streamingRouter);

// tRPC handler
app.use('/trpc/*', async (c) => {
  const trpcHandler = await import('@trpc/server/adapters/fetch');
  return trpcHandler.fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: async ({ req }) => {
      // Create a Hono context-like object
      const honoReq = { 
        header: (name: string) => req.headers.get(name),
        query: (name: string) => new URL(req.url).searchParams.get(name),
        raw: req,
      };
      const honoCtx = { 
        req: honoReq,
        res: new Response()
      };
      return createContext(req as any, honoCtx as any);
    },
  });
});

// Root health check
app.get('/', (c) => {
  return c.json({
    message: 'TriChat Backend API',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      trpc: '/trpc',
      streaming: '/stream',
      websocket: '/stream/ws',
      sse: '/stream/sse',
    },
    timestamp: new Date().toISOString(),
  });
});

export default app;
export type AppRouter = typeof appRouter; 