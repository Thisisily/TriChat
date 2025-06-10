import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { prisma } from '../lib/database.js';

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.message.deleteMany();
    await prisma.thread.deleteMany();
    await prisma.userApiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.message.deleteMany();
    await prisma.thread.deleteMany();
    await prisma.userApiKey.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  test('should connect to database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
  });

  test('should create and retrieve a user', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.username).toBe('testuser');

    const retrievedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(retrievedUser?.email).toBe('test@example.com');
  });

  test('should create a thread with messages', async () => {
    // Create a user first
    const user = await prisma.user.create({
      data: {
        email: 'thread-user@example.com',
        username: 'threaduser',
      },
    });

    // Create a thread
    const thread = await prisma.thread.create({
      data: {
        userId: user.id,
        title: 'Test Thread',
        isPublic: false,
      },
    });

    expect(thread.id).toBeDefined();
    expect(thread.title).toBe('Test Thread');
    expect(thread.userId).toBe(user.id);

    // Create messages in the thread
    const userMessage = await prisma.message.create({
      data: {
        threadId: thread.id,
        userId: user.id,
        content: 'Hello, world!',
        role: 'user',
      },
    });

    const assistantMessage = await prisma.message.create({
      data: {
        threadId: thread.id,
        userId: user.id,
        content: 'Hello back!',
        role: 'assistant',
        model: 'gpt-4o',
        provider: 'openai',
      },
    });

    expect(userMessage.content).toBe('Hello, world!');
    expect(assistantMessage.content).toBe('Hello back!');

    // Retrieve messages for the thread
    const messages = await prisma.message.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[1]?.role).toBe('assistant');
  });

  test('should handle thread branching', async () => {
    // Create a user
    const user = await prisma.user.create({
      data: {
        email: 'branch-user@example.com',
        username: 'branchuser',
      },
    });

    // Create parent thread
    const parentThread = await prisma.thread.create({
      data: {
        userId: user.id,
        title: 'Parent Thread',
        isPublic: false,
      },
    });

    // Create a branch thread
    const branchThread = await prisma.thread.create({
      data: {
        userId: user.id,
        title: 'Branch Thread',
        isPublic: false,
        parentThreadId: parentThread.id,
      },
    });

    expect(branchThread.parentThreadId).toBe(parentThread.id);

    // Retrieve with relations
    const threadWithBranches = await prisma.thread.findUnique({
      where: { id: parentThread.id },
      include: {
        branches: true,
      },
    });

    expect(threadWithBranches).toBeDefined();
    expect(threadWithBranches?.branches).toHaveLength(1);
    expect(threadWithBranches?.branches[0]?.title).toBe('Branch Thread');
  });

  test('should store and retrieve user API keys', async () => {
    // Create a user
    const user = await prisma.user.create({
      data: {
        email: 'api-user@example.com',
        username: 'apiuser',
      },
    });

    // Create an API key
    const apiKey = await prisma.userApiKey.create({
      data: {
        userId: user.id,
        provider: 'openai',
        keyName: 'My OpenAI Key',
        encrypted: 'encrypted-key-data',
      },
    });

    expect(apiKey.provider).toBe('openai');
    expect(apiKey.keyName).toBe('My OpenAI Key');

    // Retrieve user with API keys
    const userWithKeys = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        apiKeys: true,
      },
    });

    expect(userWithKeys).toBeDefined();
    expect(userWithKeys?.apiKeys).toHaveLength(1);
    expect(userWithKeys?.apiKeys[0]?.provider).toBe('openai');
  });
}); 