import { describe, expect, test } from 'bun:test';
import { appRouter } from '../trpc/router.js';
import { createContext } from '../trpc/init.js';

// Mock Hono context for testing
const mockHonoContext = {
  req: {
    header: (name: string) => {
      if (name === 'authorization') return 'Bearer test-token';
      return undefined;
    },
  },
  res: {} as Response,
} as any;

describe('tRPC Router Tests', () => {
  test('health.check should return status ok', async () => {
    const ctx = await createContext({} as any, mockHonoContext);
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.health.check();
    
    expect(result.status).toBe('ok');
    expect(result.service).toBe('TriChat API');
    expect(result.version).toBe('0.1.0');
    expect(result.timestamp).toBeTypeOf('string');
  });

  test('health.ping should return custom message', async () => {
    const ctx = await createContext({} as any, mockHonoContext);
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.health.ping({ message: 'test-message' });
    
    expect(result.status).toBe('ok');
    expect(result.message).toBe('test-message');
    expect(result.timestamp).toBeTypeOf('string');
  });

  test('health.info should return server information', async () => {
    const ctx = await createContext({} as any, mockHonoContext);
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.health.info();
    
    expect(result.name).toBe('TriChat API');
    expect(result.version).toBe('0.1.0');
    expect(result.runtime).toBe('Bun');
    expect(result.framework).toBe('Hono + tRPC');
    expect(result.uptime).toBeTypeOf('number');
  });

  test('chat.models should return available models', async () => {
    const ctx = await createContext({} as any, mockHonoContext);
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.chat.models();
    
    expect(result.providers).toBeInstanceOf(Array);
    expect(result.providers.length).toBeGreaterThan(0);
    
    const openaiProvider = result.providers.find(p => p.id === 'openai');
    expect(openaiProvider).toBeDefined();
    expect(openaiProvider?.models).toContain('gpt-4o');
  });

  test('chat.createThread should create a new thread', async () => {
    const ctx = await createContext({} as any, mockHonoContext);
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.chat.createThread({
      title: 'Test Thread',
      isPublic: false,
    });
    
    expect(result.thread.title).toBe('Test Thread');
    expect(result.thread.isPublic).toBe(false);
    expect(result.thread.id).toBeTypeOf('string');
    expect(result.thread.userId).toBeTypeOf('string');
  });
}); 