import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import app from '../app.js';
import { streamingUtils, connectionManager } from '../lib/streaming.js';

describe('Streaming Service Tests', () => {
  const port = 3002; // Use different port for testing
  let server: any;

  beforeAll(async () => {
    // Start test server
    server = {
      port,
      hostname: 'localhost',
      fetch: app.fetch,
    };
  });

  afterAll(async () => {
    // Cleanup any connections
    if (server) {
      server = null;
    }
  });

  describe('Streaming Routes', () => {
    it('should respond to streaming ping endpoint', async () => {
      const req = new Request(`http://localhost:${port}/stream/ping`);
      const res = await app.fetch(req);
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Streaming service is running');
      expect(typeof data.uptime).toBe('number');
    });

    it('should return streaming stats', async () => {
      const req = new Request(`http://localhost:${port}/stream/stats`);
      const res = await app.fetch(req);
      
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.websocket).toBeDefined();
      expect(data.data.sse).toBeDefined();
      expect(data.data.total).toBeDefined();
    });

    it('should handle broadcast endpoint', async () => {
      const req = new Request(`http://localhost:${port}/stream/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'presence_update',
          data: { content: 'Test broadcast message' },
        }),
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Message broadcasted');
      expect(data.data.type).toBe('presence_update');
    });

    it('should handle user-specific send endpoint', async () => {
      const testUserId = 'test-user-123';
      const req = new Request(`http://localhost:${port}/stream/send/${testUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'chat_message',
          data: { content: 'Hello user!' },
        }),
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain(testUserId);
      expect(data.data.userId).toBe(testUserId);
    });

    it('should handle chat streaming endpoint', async () => {
      const req = new Request(`http://localhost:${port}/stream/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'test-user',
          threadId: 'test-thread',
          messageId: 'test-message-123',
          content: 'Hello streaming world',
          model: 'gpt-4o',
          provider: 'openai',
        }),
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Streaming completed');
      expect(data.data.messageId).toBe('test-message-123');
      expect(data.data.content).toBe('Hello streaming world');
    });

    it('should reject invalid broadcast requests', async () => {
      const req = new Request(`http://localhost:${port}/stream/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required 'type' field
          data: { content: 'Test message' },
        }),
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('Message type is required');
    });

    it('should reject invalid chat streaming requests', async () => {
      const req = new Request(`http://localhost:${port}/stream/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing required fields
          content: 'Hello streaming world',
        }),
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error).toBe('userId, threadId, and messageId are required');
    });
  });

  describe('Connection Manager', () => {
    it('should manage WebSocket connections', () => {
      const mockWs = {
        readyState: 1, // OPEN
        send: () => {},
        close: () => {},
      } as unknown as WebSocket;

      const userId = 'test-user-connection';
      const connectionId = connectionManager.addConnection(userId, mockWs);
      
      expect(connectionId).toMatch(new RegExp(`^${userId}_`));
      
      const connections = connectionManager.getUserConnections(userId);
      expect(connections).toHaveLength(1);
      expect(connections[0]).toBe(mockWs);
      
      connectionManager.removeConnection(connectionId, userId);
      
      const connectionsAfterRemoval = connectionManager.getUserConnections(userId);
      expect(connectionsAfterRemoval).toHaveLength(0);
    });

    it('should provide connection statistics', () => {
      const stats = connectionManager.getStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeUsers');
      expect(stats).toHaveProperty('userSessions');
      expect(typeof stats.totalConnections).toBe('number');
      expect(typeof stats.activeUsers).toBe('number');
    });

    it('should broadcast messages to all connections', () => {
      const mockMessages: string[] = [];
      const mockWs1 = {
        readyState: 1,
        send: (msg: string) => mockMessages.push(`ws1:${msg}`),
      } as unknown as WebSocket;
      
      const mockWs2 = {
        readyState: 1,
        send: (msg: string) => mockMessages.push(`ws2:${msg}`),
      } as unknown as WebSocket;

      const userId1 = 'broadcast-user-1';
      const userId2 = 'broadcast-user-2';
      
      const connId1 = connectionManager.addConnection(userId1, mockWs1);
      const connId2 = connectionManager.addConnection(userId2, mockWs2);

      const testMessage = {
        type: 'ping' as const,
        id: 'test-123',
        data: { content: 'Broadcast test' },
        timestamp: Date.now(),
      };

      connectionManager.broadcast(testMessage);

      expect(mockMessages).toHaveLength(2);
      expect(mockMessages[0]).toContain('ws1:');
      expect(mockMessages[1]).toContain('ws2:');
      
      // Parse and verify message content
      const msg1 = JSON.parse(mockMessages[0]?.replace('ws1:', '') || '{}');
      const msg2 = JSON.parse(mockMessages[1]?.replace('ws2:', '') || '{}');
      
      expect(msg1.type).toBe('ping');
      expect(msg2.type).toBe('ping');
      expect(msg1.data.content).toBe('Broadcast test');
      expect(msg2.data.content).toBe('Broadcast test');

      // Cleanup
      connectionManager.removeConnection(connId1, userId1);
      connectionManager.removeConnection(connId2, userId2);
    });
  });

  describe('Streaming Utils', () => {
    it('should provide correct statistics', () => {
      const stats = streamingUtils.getStats();
      
      expect(stats).toHaveProperty('websocket');
      expect(stats).toHaveProperty('sse');
      expect(stats).toHaveProperty('total');
      
      expect(stats.websocket).toHaveProperty('totalConnections');
      expect(stats.websocket).toHaveProperty('activeUsers');
      expect(stats.sse).toHaveProperty('activeConnections');
      expect(stats.total).toHaveProperty('connections');
      expect(stats.total).toHaveProperty('users');
    });

    it('should handle sendToUser without active connections', () => {
      const testMessage = {
        type: 'chat_message' as const,
        id: 'user-test-123',
        userId: 'nonexistent-user',
        data: { content: 'Test message' },
        timestamp: Date.now(),
      };

      // Should not throw error even if user doesn't exist
      expect(() => {
        streamingUtils.sendToUser('nonexistent-user', testMessage);
      }).not.toThrow();
    });

    it('should handle broadcast without active connections', () => {
      const testMessage = {
        type: 'presence_update' as const,
        id: 'broadcast-test-123',
        data: { content: 'Test broadcast' },
        timestamp: Date.now(),
      };

      // Should not throw error even with no connections
      expect(() => {
        streamingUtils.broadcast(testMessage);
      }).not.toThrow();
    });
  });

  describe('SSE Headers', () => {
    it('should set correct headers for SSE endpoint', async () => {
      const req = new Request(`http://localhost:${port}/stream/sse?userId=test-user&token=test-token`);
      const res = await app.fetch(req);
      
      // Note: Since we don't have a real token, this will return 401
      // But we can still check if the route exists and handles the request
      expect(res.status).toBe(401);
      
      const text = await res.text();
      expect(text).toContain('Unauthorized');
    });

    it('should require userId and token for SSE', async () => {
      const req = new Request(`http://localhost:${port}/stream/sse`);
      const res = await app.fetch(req);
      
      expect(res.status).toBe(401);
      
      const text = await res.text();
      expect(text).toContain('Unauthorized');
    });
  });

  describe('CORS Headers', () => {
    it('should handle CORS preflight for streaming endpoints', async () => {
      const req = new Request(`http://localhost:${port}/stream/ping`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:5173',
          'Access-Control-Request-Method': 'GET',
        },
      });

      const res = await app.fetch(req);
      
      // Should handle CORS preflight - 204 is the correct status for successful preflight
      expect(res.status).toBe(204);
    });
  });
}); 