import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { createContext, router } from './trpc/init.js';
import { healthRouter } from './routes/health.js';
import { chatRouter } from './routes/chat.js';
import { authRouter } from './routes/auth.js';

const app = new Hono();

// Combine all routers into a nested structure
const appRouter = router({
  health: healthRouter,
  chat: chatRouter,
  auth: authRouter,
});

// Add tRPC middleware with proper context binding
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  })
);

// Health check endpoint (non-tRPC)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Root endpoint
app.get('/', (c) => c.json({ 
  message: 'TriChat Backend API',
  version: '1.0.0',
  endpoints: {
    health: '/health',
    trpc: '/trpc',
  }
}));

export default app;
export type AppRouter = typeof appRouter; 