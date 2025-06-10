import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createContext } from '../trpc/init';
import { healthRouter } from '../routes/health';
import { chatRouter } from '../routes/chat';
import { prisma } from '../lib/database';

// Mock Hono context for testing
const mockContext = {
  req: {
    header: () => undefined,
  } as unknown as Request,
  res: new Response(),
} as any;

describe('tRPC Router Tests', () => {
  let ctx: any;

  beforeAll(async () => {
    // Create test context
    ctx = await createContext({} as any, mockContext);
    
    // Create a test user that threads can reference
    await prisma.user.create({
      data: {
        id: 'temp-user-id',
        email: 'test@example.com',
        username: 'testuser',
      },
    });
  });

  afterAll(async () => {
    // Cleanup any test data
    await prisma.message.deleteMany({
      where: { userId: 'temp-user-id' },
    });
    await prisma.thread.deleteMany({
      where: { userId: 'temp-user-id' },
    });
    await prisma.user.deleteMany({
      where: { id: 'temp-user-id' },
    });
  });

  // Health router tests
  it('health.check should return status ok', async () => {
    const caller = healthRouter.createCaller(ctx);
    const result = await caller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('TriChat API');
    expect(result.version).toBe('0.1.0');
  });

  it('health.ping should return custom message', async () => {
    const caller = healthRouter.createCaller(ctx);
    const result = await caller.ping({ message: 'test-message' });

    expect(result.status).toBe('ok');
    expect(result.message).toBe('test-message');
  });

  it('health.info should return server information', async () => {
    const caller = healthRouter.createCaller(ctx);
    const result = await caller.info();

    expect(result.name).toBe('TriChat API');
    expect(result.framework).toBe('Hono + tRPC');
    expect(result.runtime).toBe('Bun');
  });

  // Chat router tests  
  it('chat.models should return available models', async () => {
    const caller = chatRouter.createCaller(ctx);
    const result = await caller.models();

    expect(result.providers).toHaveLength(3);
    expect(result.providers[0]?.id).toBe('openai');
    expect(result.providers[1]?.id).toBe('anthropic');
    expect(result.providers[2]?.id).toBe('google');
  });

  it('chat.createThread should create a new thread', async () => {
    const caller = chatRouter.createCaller(ctx);
    const result = await caller.createThread({
      title: 'Test Thread',
      isPublic: false,
      userId: 'temp-user-id',
    });

    expect(result.thread.title).toBe('Test Thread');
    expect(result.thread.isPublic).toBe(false);
    expect(result.thread.userId).toBe('temp-user-id');
  });

  it('chat.sendMessage should create messages', async () => {
    const caller = chatRouter.createCaller(ctx);
    
    // First create a thread
    const threadResult = await caller.createThread({
      title: 'Message Test Thread',
      isPublic: false,
      userId: 'temp-user-id',
    });

    // Then send a message
    const messageResult = await caller.sendMessage({
      threadId: threadResult.thread.id,
      content: 'Hello, world!',
      model: 'gpt-4o',
      provider: 'openai',
      userId: 'temp-user-id',
    });

    expect(messageResult.userMessage.content).toBe('Hello, world!');
    expect(messageResult.userMessage.role).toBe('user');
    expect(messageResult.assistantMessage.content).toBe('Echo: Hello, world!');
    expect(messageResult.assistantMessage.role).toBe('assistant');
  });
}); 