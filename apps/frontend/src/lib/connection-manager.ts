import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { streamingService, streamingActions, connectionStatus, type ConnectionStatus } from './streaming';
import { currentUser } from './stores/auth';
import { 
  streamingErrorHandler, 
  handleStreamingError, 
  setError, 
  clearError, 
  setRetrying,
  errorState,
  type StreamingError,
  type ErrorRecoveryStrategy,
  StreamingErrorType 
} from './error-handler';

// UI-specific connection state
export interface UIConnectionState {
  isConnecting: boolean;
  isConnected: boolean;
  hasError: boolean;
  error?: string;
  reconnectAttempts: number;
  lastConnected?: Date;
  connectionType?: 'websocket' | 'sse' | null;
  latency?: number;
}

// Connection manager class for UI
class UIConnectionManager {
  private connectionState: Writable<UIConnectionState> = writable({
    isConnecting: false,
    isConnected: false,
    hasError: false,
    reconnectAttempts: 0,
  });

  private autoReconnect = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  // Public reactive stores
  public readonly state: Readable<UIConnectionState> = this.connectionState;
  public readonly isConnected: Readable<boolean> = derived(this.connectionState, $state => $state.isConnected);
  public readonly isConnecting: Readable<boolean> = derived(this.connectionState, $state => $state.isConnecting);
  public readonly hasError: Readable<boolean> = derived(this.connectionState, $state => $state.hasError);
  public readonly connectionType: Readable<string> = derived(this.connectionState, $state => $state.connectionType || 'none');

  constructor() {
    this.initializeConnectionMonitoring();
  }

  // Initialize connection monitoring and sync with streaming service
  private initializeConnectionMonitoring() {
    // Subscribe to the main connection status from streaming service
    connectionStatus.subscribe(status => {
      if (this.isDestroyed) return;
      
      this.connectionState.update(state => ({
        ...state,
        isConnected: status.state === 'connected',
        isConnecting: status.state === 'connecting' || status.state === 'reconnecting',
        hasError: status.state === 'error',
        error: status.error,
        reconnectAttempts: status.reconnectAttempts,
        lastConnected: status.lastConnected,
        connectionType: status.type,
        latency: status.latency,
      }));

      // Handle auto-reconnection logic
      if (status.state === 'error' && this.autoReconnect && !this.reconnectTimer) {
        this.scheduleReconnect();
      } else if (status.state === 'connected' && this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    // Start periodic connection health checks
    this.startConnectionHealthCheck();
  }

  // Connect to streaming service
  public async connect(): Promise<boolean> {
    if (this.isDestroyed) return false;

    try {
      this.connectionState.update(state => ({
        ...state,
        isConnecting: true,
        hasError: false,
        error: undefined,
      }));

      // Clear any previous errors
      clearError();

      await streamingActions.connect();
      
      // Reset retry counts on successful connection
      streamingErrorHandler.clearRetryHistory();
      
      return true;
    } catch (error) {
      console.error('UI Connection Manager: Failed to connect', error);
      
      // Use error handler for better error classification and recovery
      const streamingError = streamingErrorHandler.classifyError(error instanceof Error ? error : new Error(String(error)), {
        operation: 'connect',
        timestamp: new Date().toISOString()
      });

      // Update UI state
      this.connectionState.update(state => ({
        ...state,
        isConnecting: false,
        hasError: true,
        error: streamingError.userMessage,
      }));

      // Set global error state
      setError(streamingError);

      // Handle recovery strategy
      const strategy = streamingErrorHandler.getRecoveryStrategy(streamingError);
      if (strategy.canRecover && this.autoReconnect) {
        await this.handleConnectionRecovery(streamingError, strategy);
      }

      return false;
    }
  }

  // Disconnect from streaming service
  public disconnect(): void {
    if (this.isDestroyed) return;

    this.autoReconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    streamingActions.disconnect();
    
    this.connectionState.update(state => ({
      ...state,
      isConnecting: false,
      isConnected: false,
      hasError: false,
    }));
  }

  // Enable/disable auto-reconnection
  public setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
    
    if (!enabled && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // Get current connection info
  public getConnectionInfo(): UIConnectionState {
    let currentState: UIConnectionState;
    this.connectionState.subscribe(s => currentState = s)();
    return currentState!;
  }

  // Force reconnection
  public async reconnect(): Promise<boolean> {
    this.disconnect();
    
    // Wait a moment before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.autoReconnect = true;
    return await this.connect();
  }

  // Handle connection recovery based on error strategy
  private async handleConnectionRecovery(error: StreamingError, strategy: ErrorRecoveryStrategy): Promise<void> {
    if (!strategy.canRecover || this.isDestroyed) return;

    // Record retry attempt
    streamingErrorHandler.recordRetryAttempt(error);

    // Check if we should still retry
    if (!streamingErrorHandler.shouldRetry(error)) {
      console.warn('UI Connection Manager: Max retry attempts reached for', error.code);
      return;
    }

    // Calculate delay using error handler
    const delay = streamingErrorHandler.getRetryDelay(error);
    
    console.log(`UI Connection Manager: Scheduling recovery in ${delay}ms for error: ${error.code}`);

    // Set retrying state
    setRetrying(true, streamingErrorHandler.getRecentErrors().length);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      setRetrying(false);
      
      if (this.autoReconnect && !this.isDestroyed) {
        console.log('UI Connection Manager: Attempting error recovery reconnection');
        const success = await this.connect();
        
        if (success) {
          streamingErrorHandler.resetRetryCount(error.code);
          clearError();
        }
      }
    }, delay);
  }

  // Schedule automatic reconnection
  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.autoReconnect || this.isDestroyed) return;

    const currentState = this.getConnectionInfo();
    
    // Use error handler for better delay calculation if we have error context
    let delay = Math.min(1000 * Math.pow(2, currentState.reconnectAttempts), 30000); // Fallback exponential backoff
    
    // Check if we have recent connection errors to use for better delay calculation
    const recentErrors = streamingErrorHandler.getRecentErrors(StreamingErrorType.CONNECTION, 5);
    if (recentErrors.length > 0) {
      const lastError = recentErrors[recentErrors.length - 1];
      delay = streamingErrorHandler.getRetryDelay(lastError);
    }

    console.log(`UI Connection Manager: Scheduling reconnect in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      if (this.autoReconnect && !this.isDestroyed) {
        console.log('UI Connection Manager: Attempting automatic reconnection');
        await this.connect();
      }
    }, delay);
  }

  // Monitor connection health
  private startConnectionHealthCheck(): void {
    if (this.connectionCheckInterval) return;

    this.connectionCheckInterval = setInterval(() => {
      if (this.isDestroyed) return;

      const connectionInfo = streamingActions.getConnectionInfo();
      const currentState = this.getConnectionInfo();
      
      // Check if connection is stale
      if (currentState.isConnected && currentState.lastConnected) {
        const timeSinceLastConnection = Date.now() - currentState.lastConnected.getTime();
        const isStale = timeSinceLastConnection > 60000; // 1 minute
        
        if (isStale && this.autoReconnect) {
          console.log('UI Connection Manager: Connection appears stale, attempting reconnect');
          this.reconnect();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Cleanup resources
  public destroy(): void {
    this.isDestroyed = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    this.disconnect();
  }
}

// Global connection manager instance
export const uiConnectionManager = new UIConnectionManager();

// Reactive stores for easy use in components
export const connectionState = uiConnectionManager.state;
export const isConnected = uiConnectionManager.isConnected;
export const isConnecting = uiConnectionManager.isConnecting;
export const hasConnectionError = uiConnectionManager.hasError;
export const connectionType = uiConnectionManager.connectionType;

// Auto-connect when user changes
let userUnsubscribe: (() => void) | null = null;
let currentUserId: string | null = null;

const setupAutoConnect = () => {
  if (userUnsubscribe) {
    userUnsubscribe();
  }

  userUnsubscribe = currentUser.subscribe(user => {
    const newUserId = user?.id || null;
    
    // If user changed, reconnect
    if (newUserId !== currentUserId) {
      currentUserId = newUserId;
      
      if (newUserId) {
        console.log('UI Connection Manager: User authenticated, connecting...');
        uiConnectionManager.connect();
      } else {
        console.log('UI Connection Manager: User signed out, disconnecting...');
        uiConnectionManager.disconnect();
      }
    }
  });
};

// Initialize auto-connect
setupAutoConnect();

// Cleanup function for when the app is unloaded
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    uiConnectionManager.destroy();
  });
}

// Connection utilities for components
export const connectionUtils = {
  // Connect manually
  connect: () => uiConnectionManager.connect(),
  
  // Disconnect manually
  disconnect: () => uiConnectionManager.disconnect(),
  
  // Reconnect
  reconnect: () => uiConnectionManager.reconnect(),
  
  // Toggle auto-reconnect
  setAutoReconnect: (enabled: boolean) => uiConnectionManager.setAutoReconnect(enabled),
  
  // Get current state
  getState: () => uiConnectionManager.getConnectionInfo(),
  
  // Check if ready for streaming
  isReadyForStreaming: (): boolean => {
    const state = uiConnectionManager.getConnectionInfo();
    return state.isConnected && !state.hasError;
  },
  
  // Wait for connection
  waitForConnection: (timeoutMs = 10000): Promise<boolean> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, timeoutMs);
      
      const unsubscribe = isConnected.subscribe(connected => {
        if (connected) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      });
    });
  },
};

// The manager is already exported above as a const 