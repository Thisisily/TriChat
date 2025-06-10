import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { appRouter } from '../trpc/router.js';
import { createContext } from '../trpc/init.js';
import { prisma } from '../lib/database.js';

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
  let testUserId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.message.deleteMany();
    await prisma.thread.deleteMany();
    await prisma.userApiKey.deleteMany();
    await prisma.user.deleteMany();

    // Create a test user for tRPC tests
    const testUser = await prisma.user.create({
      data: {
        email: 'trpc-test@example.com',
        username: 'trpctest',
      },
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.message.deleteMany();
    await prisma.thread.deleteMany();
    await prisma.userApiKey.deleteMany();
    await prisma.user.deleteMany();
  });

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
      userId: testUserId, // Use the actual test user ID
    });
    
    expect(result.thread.title).toBe('Test Thread');
    expect(result.thread.isPublic).toBe(false);
    expect(result.thread.id).toBeTypeOf('string');
    expect(result.thread.userId).toBe(testUserId);
  });

  test('chat.sendMessage should create messages', async () => {
    const ctx = await createContext({} as any, mockHonoContext);
    const caller = appRouter.createCaller(ctx);
    
    // First create a thread
    const threadResult = await caller.chat.createThread({
      title: 'Message Test Thread',
      isPublic: false,
      userId: testUserId,
    });
    
    // Then send a message
    const messageResult = await caller.chat.sendMessage({
      threadId: threadResult.thread.id,
      content: 'Hello, test!',
      model: 'gpt-4o',
      provider: 'openai',
      userId: testUserId,
    });
    
    expect(messageResult.userMessage.content).toBe('Hello, test!');
    expect(messageResult.userMessage.role).toBe('user');
    expect(messageResult.assistantMessage.content).toBe('Echo: Hello, test!');
    expect(messageResult.assistantMessage.role).toBe('assistant');
  });
}); 