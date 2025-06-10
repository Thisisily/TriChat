import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { compress } from 'hono/compress';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', compress());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);

// Health check
app.get('/health', (c: Context) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// API routes
app.get('/api/hello', (c: Context) => {
  return c.json({ message: 'Hello from TriChat API!' });
});

// Start server
const port = process.env['PORT'] || 3001;

console.log(`🚀 TriChat API server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
