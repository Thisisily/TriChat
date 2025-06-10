import { describe, it, expect, afterAll, beforeEach } from 'bun:test';
import { prisma } from '../lib/database';

describe('Authentication Tests', () => {
  // Use unique IDs for each test run to avoid conflicts
  const testId = Date.now().toString();
  const mockUser = {
    id: `user_test_${testId}`,
    email: `test_${testId}@example.com`,
    username: `testuser_${testId}`,
  };

  beforeEach(async () => {
    // Clean up any existing test data before each test
    await prisma.userApiKey.deleteMany({
      where: { userId: mockUser.id },
    });
    await prisma.user.deleteMany({
      where: { 
        OR: [
          { email: mockUser.email },
          { id: mockUser.id }
        ]
      },
    });
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.userApiKey.deleteMany({
      where: { userId: mockUser.id },
    });
    await prisma.user.deleteMany({
      where: { 
        OR: [
          { email: mockUser.email },
          { id: mockUser.id }
        ]
      },
    });
  });

  it('should sync user to database', async () => {
    const { syncUserToDatabase } = await import('../lib/auth');
    
    // Mock Clerk user object
    const clerkUser = {
      id: mockUser.id,
      email_addresses: [{ email_address: mockUser.email }],
      username: mockUser.username,
    };

    await syncUserToDatabase(clerkUser);

    // Verify user was created
    const dbUser = await prisma.user.findUnique({
      where: { id: mockUser.id },
    });

    expect(dbUser).toBeTruthy();
    expect(dbUser?.email).toBe(mockUser.email);
    expect(dbUser?.username).toBe(mockUser.username);
  });

  it('should update existing user on sync', async () => {
    const { syncUserToDatabase } = await import('../lib/auth');
    
    // First create a user
    await prisma.user.create({
      data: {
        id: mockUser.id,
        email: mockUser.email,
        username: 'oldusername',
      },
    });

    // Mock Clerk user with updated data
    const clerkUser = {
      id: mockUser.id,
      email_addresses: [{ email_address: mockUser.email }],
      username: 'newusername',
    };

    await syncUserToDatabase(clerkUser);

    // Verify user was updated
    const dbUser = await prisma.user.findUnique({
      where: { id: mockUser.id },
    });

    expect(dbUser?.username).toBe('newusername');
  });

  it('should handle getUserFromAuth with invalid token', async () => {
    const { getUserFromAuth } = await import('../lib/auth');
    
    // Test with no auth header
    const result1 = await getUserFromAuth(undefined);
    expect(result1).toBeNull();

    // Test with invalid format
    const result2 = await getUserFromAuth('Invalid token');
    expect(result2).toBeNull();

    // Test with bearer but invalid token
    const result3 = await getUserFromAuth('Bearer invalid_token');
    expect(result3).toBeNull();
  });

  it('should handle getUserFromAuth with test token', async () => {
    const { getUserFromAuth } = await import('../lib/auth');
    
    // Test with the test token
    const result = await getUserFromAuth('Bearer test_token');
    expect(result).toBeTruthy();
    expect(result?.userId).toBe('user_test123');
    expect(result?.email).toBe('test@example.com');
  });

  it('should create and manage user API keys', async () => {
    // First ensure user exists
    await prisma.user.upsert({
      where: { id: mockUser.id },
      update: {},
      create: {
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
      },
    });

    // Create an API key
    const apiKey = await prisma.userApiKey.create({
      data: {
        userId: mockUser.id,
        provider: 'openai',
        keyName: 'Test OpenAI Key',
        encrypted: 'encrypted_api_key_data',
      },
    });

    expect(apiKey.provider).toBe('openai');
    expect(apiKey.keyName).toBe('Test OpenAI Key');
    expect(apiKey.userId).toBe(mockUser.id);

    // Verify user can have multiple API keys
    await prisma.userApiKey.create({
      data: {
        userId: mockUser.id,
        provider: 'anthropic',
        keyName: 'Test Anthropic Key',
        encrypted: 'encrypted_anthropic_key_data',
      },
    });

    const userApiKeys = await prisma.userApiKey.findMany({
      where: { userId: mockUser.id },
    });

    expect(userApiKeys).toHaveLength(2);
  });

  it('should verify webhook signature function exists', () => {
    const { verifyWebhookSignature } = require('../lib/auth');
    
    // Basic test - function should exist and return boolean
    const result = verifyWebhookSignature('test payload', {});
    expect(typeof result).toBe('boolean');
  });
}); 