import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
// import { compress } from 'hono/compress'; // Temporarily disabled due to CompressionStream issue
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './trpc/router.js';
import { createContext } from './trpc/init.js';
import { streamingRouter } from './routes/streaming.js';
import { websocket } from './lib/streaming.js';

const app = new Hono();

// Middleware
app.use('*', logger());
// app.use('*', compress()); // Temporarily disabled - will re-enable after fixing CompressionStream
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);

// Health check (legacy endpoint)
app.get('/health', (c: Context) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// Streaming routes (WebSocket & SSE)
app.route('/stream', streamingRouter);

// tRPC endpoint
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  })
);

// API routes (legacy)
app.get('/api/hello', (c: Context) => {
  return c.json({ message: 'Hello from TriChat API!' });
});

// WebSocket support for future streaming (placeholder)
app.get('/ws', (c: Context) => {
  return c.text('WebSocket endpoint ready for streaming implementation');
});

// Start server
const port = process.env['PORT'] || 3001;

console.log(`🚀 TriChat API server starting on port ${port}`);
console.log(`📡 tRPC endpoint available at http://localhost:${port}/trpc`);
console.log(`🌊 Streaming endpoints available at http://localhost:${port}/stream`);
console.log(`🔗 Health check at http://localhost:${port}/health`);

export default {
  port,
  fetch: app.fetch,
  websocket,
};
 