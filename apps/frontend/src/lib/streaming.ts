import { writable, type Writable } from 'svelte/store';
import { currentUser, getSessionToken } from './stores/auth';

// Timer type for browser environments
type Timer = ReturnType<typeof setTimeout>;

// Stream message types (matching backend)
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
  data: Record<string, unknown>;
  timestamp: number;
}

export interface StreamingConfig {
  baseUrl: string;
  enableWebSocket: boolean;
  enableSSE: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  pingInterval: number;
}

// Default configuration
const defaultConfig: StreamingConfig = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  enableWebSocket: true,
  enableSSE: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  pingInterval: 30000,
};

// Connection state
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface ConnectionStatus {
  state: ConnectionState;
  type: 'websocket' | 'sse' | null;
  error?: string;
  reconnectAttempts: number;
  lastConnected?: Date;
  latency?: number;
}

// Streaming stores
export const connectionStatus: Writable<ConnectionStatus> = writable({
  state: 'disconnected',
  type: null,
  reconnectAttempts: 0,
});

export const streamMessages: Writable<StreamMessage[]> = writable([]);
export const presenceUsers: Writable<Set<string>> = writable(new Set());

// Streaming service class
class StreamingService {
  private config: StreamingConfig;
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private reconnectTimer: Timer | null = null;
  private pingTimer: Timer | null = null;
  private reconnectAttempts = 0;
  private messageHandlers = new Map<StreamMessageType, Set<(message: StreamMessage) => void>>();
  private isManualDisconnect = false;

  constructor(config: Partial<StreamingConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // Public API
  async connect(): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) {
      console.warn('Cannot connect streaming: no authenticated user');
      return;
    }

    this.isManualDisconnect = false;
    
    // Try WebSocket first, fallback to SSE
    if (this.config.enableWebSocket) {
      await this.connectWebSocket(user.id);
    } else if (this.config.enableSSE) {
      await this.connectSSE(user.id);
    }
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    this.cleanup();
    connectionStatus.update(status => ({ ...status, state: 'disconnected', type: null }));
  }

  // Message handling
  on(type: StreamMessageType, handler: (message: StreamMessage) => void): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(type);
        }
      }
    };
  }

  // Send message (only works with WebSocket)
  send(message: Omit<StreamMessage, 'id' | 'timestamp'>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const fullMessage: StreamMessage = {
        ...message,
        id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };
      
      this.ws.send(JSON.stringify(fullMessage));
      return true;
    }
    return false;
  }

  // Get connection info
  getConnectionInfo(): ConnectionStatus {
    return {
      state: this.ws?.readyState === WebSocket.OPEN ? 'connected' : 
             this.sse?.readyState === EventSource.OPEN ? 'connected' : 'disconnected',
      type: this.ws?.readyState === WebSocket.OPEN ? 'websocket' : 
            this.sse?.readyState === EventSource.OPEN ? 'sse' : null,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  // Private methods
  private getCurrentUser() {
    let user: any = null;
    currentUser.subscribe(u => user = u)();
    return user;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await getSessionToken();
    } catch (error) {
      console.error('Failed to get session token:', error);
      return null;
    }
  }

  private async connectWebSocket(userId: string): Promise<void> {
    try {
      connectionStatus.update(status => ({ ...status, state: 'connecting', type: 'websocket' }));

      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const wsUrl = `${this.config.baseUrl.replace('http', 'ws')}/stream/ws?userId=${encodeURIComponent(userId)}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = (_event) => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        connectionStatus.update(status => ({ 
          ...status, 
          state: 'connected', 
          type: 'websocket',
          lastConnected: new Date(),
          error: undefined
        }));
        
        this.startPing();
      };

      this.ws.onmessage = (_event) => {
        try {
          const message: StreamMessage = JSON.parse(_event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (_error) => {
        console.error('WebSocket error');
        this.stopPing();
        
        if (!this.isManualDisconnect) {
          if (this.config.enableSSE) {
            console.log('Falling back to SSE...');
            this.connectSSE(userId);
          } else {
            this.scheduleReconnect(() => this.connectWebSocket(userId));
          }
        }
      };

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      
      if (this.config.enableSSE) {
        console.log('Falling back to SSE...');
        await this.connectSSE(userId);
      } else {
        connectionStatus.update(status => ({ 
          ...status, 
          state: 'error', 
          error: error instanceof Error ? error.message : 'Connection failed'
        }));
      }
    }
  }

  private async connectSSE(userId: string): Promise<void> {
    try {
      connectionStatus.update(status => ({ ...status, state: 'connecting', type: 'sse' }));

      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const sseUrl = `${this.config.baseUrl}/stream/sse?userId=${encodeURIComponent(userId)}`;
      
      this.sse = new EventSource(sseUrl);

      this.sse.onopen = (_event) => {
        console.log('SSE connected');
        this.reconnectAttempts = 0;
        connectionStatus.update(status => ({ 
          ...status, 
          state: 'connected', 
          type: 'sse',
          lastConnected: new Date(),
          error: undefined
        }));
      };

      this.sse.onmessage = (_event) => {
        try {
          const message: StreamMessage = JSON.parse(_event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      this.sse.onerror = (_event) => {
        console.error('SSE error');
        
        if (!this.isManualDisconnect) {
          connectionStatus.update(status => ({ ...status, state: 'error', error: 'SSE connection failed' }));
          this.scheduleReconnect(() => this.connectSSE(userId));
        }
      };

    } catch (error) {
      console.error('SSE connection failed:', error);
      connectionStatus.update(status => ({ 
        ...status, 
        state: 'error', 
        error: error instanceof Error ? error.message : 'SSE connection failed'
      }));
    }
  }

  private handleMessage(message: StreamMessage): void {
    // Store message
    streamMessages.update(messages => [...messages, message]);

    // Handle specific message types
    switch (message.type) {
      case 'presence_update':
        this.handlePresenceUpdate(message);
        break;
      case 'ping':
        this.handlePing(message);
        break;
      case 'pong':
        this.handlePong(message);
        break;
    }

    // Call registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Message handler error:', error);
        }
      });
    }
  }

  private handlePresenceUpdate(message: StreamMessage): void {
    const data = message.data as { userId?: string; status?: string };
    const { userId, status } = data;
    
    if (typeof userId === 'string' && typeof status === 'string') {
      presenceUsers.update(users => {
        const newUsers = new Set(users);
        if (status === 'online') {
          newUsers.add(userId);
        } else if (status === 'offline') {
          newUsers.delete(userId);
        }
        return newUsers;
      });
    }
  }

  private handlePing(message: StreamMessage): void {
    // Respond with pong if WebSocket is available
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'pong',
        data: message.data,
      });
    }
  }

  private handlePong(message: StreamMessage): void {
    // Calculate latency if we have timing data
    const data = message.data as { timestamp?: number };
    if (typeof data.timestamp === 'number') {
      const latency = Date.now() - data.timestamp;
      connectionStatus.update(status => ({ ...status, latency }));
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          data: { timestamp: Date.now() },
        });
      }
    }, this.config.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(connectFn: () => Promise<void>): void {
    if (this.isManualDisconnect || this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      connectionStatus.update(status => ({ 
        ...status, 
        state: 'error', 
        error: 'Max reconnection attempts reached'
      }));
      return;
    }

    this.reconnectAttempts++;
    connectionStatus.update(status => ({ 
      ...status, 
      state: 'reconnecting',
      reconnectAttempts: this.reconnectAttempts
    }));

    this.reconnectTimer = setTimeout(async () => {
      if (!this.isManualDisconnect) {
        await connectFn();
      }
    }, this.config.reconnectInterval);
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }

    this.stopPing();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.reconnectAttempts = 0;
  }
}

// Global streaming service instance
export const streamingService = new StreamingService();

// Convenience functions
export const streamingActions = {
  connect: () => streamingService.connect(),
  disconnect: () => streamingService.disconnect(),
  
  // Message sending
  sendChatMessage: (threadId: string, content: string) => {
    const user = streamingService['getCurrentUser']();
    if (!user) return false;
    
    return streamingService.send({
      type: 'chat_message',
      threadId,
      userId: user.id,
      data: { content, role: 'user' },
    });
  },

  // Presence updates
  updatePresence: (status: 'online' | 'offline' | 'typing', threadId?: string) => {
    const user = streamingService['getCurrentUser']();
    if (!user) return false;
    
    return streamingService.send({
      type: 'presence_update',
      userId: user.id,
      threadId,
      data: { status, userId: user.id, threadId },
    });
  },

  // Event subscriptions
  onChatResponse: (handler: (message: StreamMessage) => void) => {
    return streamingService.on('chat_response', handler);
  },

  onChatComplete: (handler: (message: StreamMessage) => void) => {
    return streamingService.on('chat_complete', handler);
  },

  onPresenceUpdate: (handler: (message: StreamMessage) => void) => {
    return streamingService.on('presence_update', handler);
  },

  onThreadUpdate: (handler: (message: StreamMessage) => void) => {
    return streamingService.on('thread_update', handler);
  },

  // Connection management
  getConnectionInfo: () => streamingService.getConnectionInfo(),
}; 