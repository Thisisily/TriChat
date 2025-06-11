import type { Context } from 'hono';
import { createBunWebSocket } from 'hono/bun';

// Message types for real-time communication
export type StreamMessageType = 
  | 'chat_message' 
  | 'chat_response' 
  | 'chat_complete'
  | 'thread_update'
  | 'presence_update'
  | 'error'
  | 'ping'
  | 'pong';

export interface StreamMessage {
  type: StreamMessageType;
  id: string;
  threadId?: string;
  userId?: string;
  data: any;
  timestamp: number;
}

export interface ChatStreamData {
  messageId: string;
  content: string;
  role: 'user' | 'assistant';
  model?: string;
  provider?: string;
  isComplete?: boolean;
  delta?: string;
}

export interface PresenceData {
  userId: string;
  status: 'online' | 'offline' | 'typing';
  threadId?: string;
}

// Connection management
class ConnectionManager {
  private connections = new Map<string, WebSocket>();
  private userSessions = new Map<string, Set<string>>();

  addConnection(userId: string, ws: WebSocket): string {
    const connectionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.connections.set(connectionId, ws);
    
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(connectionId);

    console.log(`WebSocket connection added: ${connectionId} for user ${userId}`);
    return connectionId;
  }

  removeConnection(connectionId: string, userId?: string): void {
    if (this.connections.has(connectionId)) {
      this.connections.delete(connectionId);
      
      if (userId && this.userSessions.has(userId)) {
        this.userSessions.get(userId)!.delete(connectionId);
        if (this.userSessions.get(userId)!.size === 0) {
          this.userSessions.delete(userId);
        }
      }
      
      console.log(`WebSocket connection removed: ${connectionId}`);
    }
  }

  getConnection(connectionId: string): WebSocket | undefined {
    return this.connections.get(connectionId);
  }

  getUserConnections(userId: string): WebSocket[] {
    const connectionIds = this.userSessions.get(userId);
    if (!connectionIds) return [];
    
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((ws): ws is WebSocket => !!ws);
  }

  broadcast(message: StreamMessage, excludeUserId?: string): void {
    const messageStr = JSON.stringify(message);
    
    for (const [connectionId, ws] of this.connections) {
      if (excludeUserId) {
        const userId = connectionId.split('_')[0];
        if (userId === excludeUserId) continue;
      }
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      } else {
        // Clean up closed connections
        this.removeConnection(connectionId);
      }
    }
  }

  sendToUser(userId: string, message: StreamMessage): void {
    const connections = this.getUserConnections(userId);
    const messageStr = JSON.stringify(message);
    
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  sendToThread(_threadId: string, message: StreamMessage): void {
    // For now, broadcast to all - in production, you'd maintain thread subscriptions
    this.broadcast(message);
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      activeUsers: this.userSessions.size,
      userSessions: Object.fromEntries(
        Array.from(this.userSessions.entries()).map(([userId, connections]) => [
          userId, 
          connections.size
        ])
      )
    };
  }


}

// Global connection manager instance
export const connectionManager = new ConnectionManager();

// WebSocket upgrade handler
export const { upgradeWebSocket, websocket } = createBunWebSocket();

// WebSocket message handlers
export const createWebSocketHandler = () => {
  return upgradeWebSocket((c) => {
    const userId = c.req.query('userId');
    // Note: Authorization will be handled in the route setup
    // Here we assume the connection is already authorized
    
    let connectionId: string | undefined;
    let userIdValue: string = userId || 'anonymous';

    return {
      onOpen(_event, ws) {
        console.log(`WebSocket opened for user: ${userIdValue}`);
        
        connectionId = connectionManager.addConnection(userIdValue, ws.raw as WebSocket);

        // Send welcome message
        const welcomeMessage: StreamMessage = {
          type: 'presence_update',
          id: `welcome_${Date.now()}`,
          userId: userIdValue,
          data: { 
            status: 'online',
            connectionId,
            message: 'Connected to TriChat streaming' 
          },
          timestamp: Date.now(),
        };
        
        ws.send(JSON.stringify(welcomeMessage));

        // Broadcast user online status
        connectionManager.broadcast({
          type: 'presence_update',
          id: `presence_${Date.now()}`,
          userId: userIdValue,
          data: { status: 'online', userId: userIdValue },
          timestamp: Date.now(),
        }, userIdValue);
      },

      onMessage(event, ws) {
        try {
          const message: StreamMessage = JSON.parse(event.data.toString());
          console.log(`WebSocket message received:`, message);

          // Handle different message types
          switch (message.type) {
            case 'ping':
              // Respond with pong
              ws.send(JSON.stringify({
                ...message,
                type: 'pong',
                timestamp: Date.now(),
              }));
              break;

            case 'chat_message':
              // Broadcast chat message to thread participants
              if (message.threadId) {
                connectionManager.sendToThread(message.threadId, {
                  ...message,
                  timestamp: Date.now(),
                });
              }
              break;

            case 'presence_update':
              // Broadcast presence update
              connectionManager.broadcast({
                ...message,
                userId: userIdValue,
                timestamp: Date.now(),
              }, userIdValue);
              break;

            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          
          const errorMessage: StreamMessage = {
            type: 'error',
            id: `error_${Date.now()}`,
            data: { error: 'Invalid message format' },
            timestamp: Date.now(),
          };
          
          ws.send(JSON.stringify(errorMessage));
        }
      },

      onClose(_event, _ws) {
        console.log(`WebSocket closed for user: ${userIdValue}`);
        
        if (connectionId) {
          connectionManager.removeConnection(connectionId, userIdValue);
        }

        // Broadcast user offline status if no more connections
        const userConnections = connectionManager.getUserConnections(userIdValue);
        if (userConnections.length === 0) {
          connectionManager.broadcast({
            type: 'presence_update',
            id: `presence_${Date.now()}`,
            userId: userIdValue,
            data: { status: 'offline', userId: userIdValue },
            timestamp: Date.now(),
          });
        }
      },

      onError(event, _ws) {
        console.error('WebSocket error for user:', userIdValue, event);
        
        if (connectionId) {
          connectionManager.removeConnection(connectionId, userIdValue);
        }
      },
    };
  });
};

// SSE (Server-Sent Events) stream handler
export const createSSEHandler = () => {
  return async (c: Context) => {
    const userId = c.req.query('userId');
    const token = c.req.header('authorization')?.replace('Bearer ', '');
    
    if (!userId || !token) {
      return c.text('Unauthorized: userId and token required', 401);
    }

    // Set SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', 'Cache-Control');

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        console.log(`SSE connection opened for user: ${userId}`);

        // Send initial connection event
        const welcomeEvent = `data: ${JSON.stringify({
          type: 'presence_update',
          id: `sse_welcome_${Date.now()}`,
          userId,
          data: { 
            status: 'online',
            message: 'Connected to TriChat SSE stream',
            connectionType: 'SSE'
          },
          timestamp: Date.now(),
        })}\n\n`;
        
        controller.enqueue(new TextEncoder().encode(welcomeEvent));

        // Send periodic ping to keep connection alive
        const pingInterval = setInterval(() => {
          try {
            const pingEvent = `data: ${JSON.stringify({
              type: 'ping',
              id: `ping_${Date.now()}`,
              data: {},
              timestamp: Date.now(),
            })}\n\n`;
            
            controller.enqueue(new TextEncoder().encode(pingEvent));
          } catch (error) {
            console.error('SSE ping error:', error);
            clearInterval(pingInterval);
          }
        }, 30000); // Ping every 30 seconds

        // Store SSE controller for sending messages
        // In production, you'd want a more sophisticated storage mechanism
        (globalThis as any).sseControllers = (globalThis as any).sseControllers || new Map();
        (globalThis as any).sseControllers.set(userId, { controller, pingInterval });

        // Handle connection close
        c.req.raw.signal?.addEventListener('abort', () => {
          console.log(`SSE connection closed for user: ${userId}`);
          clearInterval(pingInterval);
          (globalThis as any).sseControllers?.delete(userId);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  };
};

// Utility functions for sending messages
export const streamingUtils = {
  // Send message via WebSocket or SSE
  sendToUser(userId: string, message: StreamMessage): void {
    // Try WebSocket first
    connectionManager.sendToUser(userId, message);

    // Also try SSE if available
    const sseControllers = (globalThis as any).sseControllers as Map<string, any>;
    if (sseControllers?.has(userId)) {
      const { controller } = sseControllers.get(userId);
      try {
        const sseEvent = `data: ${JSON.stringify(message)}\n\n`;
        controller.enqueue(new TextEncoder().encode(sseEvent));
      } catch (error) {
        console.error('SSE send error:', error);
        sseControllers.delete(userId);
      }
    }
  },

  // Broadcast to all connected users
  broadcast(message: StreamMessage, excludeUserId?: string): void {
    connectionManager.broadcast(message, excludeUserId);

    // Also broadcast via SSE
    const sseControllers = (globalThis as any).sseControllers as Map<string, any>;
    if (sseControllers) {
      const sseEvent = `data: ${JSON.stringify(message)}\n\n`;
      const encoded = new TextEncoder().encode(sseEvent);
      
      for (const [userId, { controller }] of sseControllers) {
        if (excludeUserId && userId === excludeUserId) continue;
        
        try {
          controller.enqueue(encoded);
        } catch (error) {
          console.error(`SSE broadcast error for user ${userId}:`, error);
          sseControllers.delete(userId);
        }
      }
    }
  },

  // Send to specific thread participants
  sendToThread(threadId: string, message: StreamMessage): void {
    connectionManager.sendToThread(threadId, message);
  },

  // Get connection statistics
  getStats() {
    const wsStats = connectionManager.getStats();
    const sseControllers = (globalThis as any).sseControllers as Map<string, any>;
    
    return {
      websocket: wsStats,
      sse: {
        activeConnections: sseControllers?.size || 0,
        users: Array.from(sseControllers?.keys() || []),
      },
      total: {
        connections: wsStats.totalConnections + (sseControllers?.size || 0),
        users: wsStats.activeUsers,
      }
    };
  },
}; 