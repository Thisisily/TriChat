export interface StreamingError {
  type: StreamingErrorType;
  code: string;
  message: string;
  userMessage: string;
  originalError?: Error;
  timestamp: Date;
  retryable: boolean;
  retryDelay?: number;
  maxRetries?: number;
  metadata?: Record<string, any>;
}

export enum StreamingErrorType {
  CONNECTION = 'connection',
  AUTHENTICATION = 'authentication',
  PARSING = 'parsing',
  SERVER = 'server',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  QUOTA_EXCEEDED = 'quota_exceeded',
  MODEL_ERROR = 'model_error',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

export interface ErrorRecoveryStrategy {
  canRecover: boolean;
  preserveContent: boolean;
  immediateRetry: boolean;
  requiresUserAction: boolean;
  recoveryAction?: () => Promise<void>;
  fallbackMode?: 'polling' | 'manual' | 'offline';
}

export class StreamingErrorHandler {
  private errorHistory: StreamingError[] = [];
  private retryAttempts = new Map<string, number>();
  private maxHistorySize = 100;

  // Error classification and user-friendly messaging
  classifyError(error: Error | string, context?: Record<string, any>): StreamingError {
    const timestamp = new Date();
    let errorType: StreamingErrorType;
    let code: string;
    let message: string;
    let userMessage: string;
    let retryable = true;
    let retryDelay = 1000;
    let maxRetries = 3;

    if (typeof error === 'string') {
      message = error;
    } else {
      message = error.message;
    }

    // Classify error by message content and context
    if (this.isConnectionError(message)) {
      errorType = StreamingErrorType.CONNECTION;
      code = 'CONNECTION_FAILED';
      userMessage = 'Unable to connect to the chat service. Please check your internet connection.';
      retryDelay = 2000;
      maxRetries = 5;
    } else if (this.isAuthenticationError(message)) {
      errorType = StreamingErrorType.AUTHENTICATION;
      code = 'AUTH_FAILED';
      userMessage = 'Authentication failed. Please sign in again.';
      retryable = false;
    } else if (this.isNetworkError(message)) {
      errorType = StreamingErrorType.NETWORK;
      code = 'NETWORK_ERROR';
      userMessage = 'Network error occurred. Retrying connection...';
      retryDelay = 3000;
      maxRetries = 4;
    } else if (this.isTimeoutError(message)) {
      errorType = StreamingErrorType.TIMEOUT;
      code = 'REQUEST_TIMEOUT';
      userMessage = 'Request timed out. Please try again.';
      retryDelay = 5000;
      maxRetries = 3;
    } else if (this.isRateLimitError(message)) {
      errorType = StreamingErrorType.RATE_LIMIT;
      code = 'RATE_LIMITED';
      userMessage = 'Too many requests. Please wait a moment before trying again.';
      retryDelay = 10000;
      maxRetries = 2;
    } else if (this.isQuotaError(message)) {
      errorType = StreamingErrorType.QUOTA_EXCEEDED;
      code = 'QUOTA_EXCEEDED';
      userMessage = 'Usage quota exceeded. Please check your account limits.';
      retryable = false;
    } else if (this.isModelError(message)) {
      errorType = StreamingErrorType.MODEL_ERROR;
      code = 'MODEL_ERROR';
      userMessage = 'AI model encountered an error. Trying alternative approach...';
      retryDelay = 2000;
      maxRetries = 2;
    } else if (this.isParsingError(message)) {
      errorType = StreamingErrorType.PARSING;
      code = 'PARSING_ERROR';
      userMessage = 'Error processing response. Attempting to recover...';
      retryDelay = 1000;
      maxRetries = 2;
    } else if (this.isServerError(message)) {
      errorType = StreamingErrorType.SERVER;
      code = 'SERVER_ERROR';
      userMessage = 'Server error occurred. Please try again in a moment.';
      retryDelay = 5000;
      maxRetries = 3;
    } else {
      errorType = StreamingErrorType.UNKNOWN;
      code = 'UNKNOWN_ERROR';
      userMessage = 'An unexpected error occurred. Please try again.';
      retryDelay = 2000;
      maxRetries = 2;
    }

    const streamingError: StreamingError = {
      type: errorType,
      code,
      message,
      userMessage,
      originalError: typeof error === 'object' ? error : undefined,
      timestamp,
      retryable,
      retryDelay,
      maxRetries,
      metadata: context
    };

    this.addToHistory(streamingError);
    return streamingError;
  }

  // Determine recovery strategy based on error type and context
  getRecoveryStrategy(error: StreamingError, partialContent?: string): ErrorRecoveryStrategy {
    const hasPartialContent = Boolean(partialContent && partialContent.trim());

    switch (error.type) {
      case StreamingErrorType.CONNECTION:
      case StreamingErrorType.NETWORK:
        return {
          canRecover: true,
          preserveContent: hasPartialContent,
          immediateRetry: false,
          requiresUserAction: false,
          fallbackMode: 'polling'
        };

      case StreamingErrorType.AUTHENTICATION:
        return {
          canRecover: false,
          preserveContent: hasPartialContent,
          immediateRetry: false,
          requiresUserAction: true,
          fallbackMode: 'manual'
        };

      case StreamingErrorType.PARSING:
        return {
          canRecover: true,
          preserveContent: true,
          immediateRetry: true,
          requiresUserAction: false
        };

      case StreamingErrorType.TIMEOUT:
        return {
          canRecover: true,
          preserveContent: hasPartialContent,
          immediateRetry: false,
          requiresUserAction: false,
          fallbackMode: 'polling'
        };

      case StreamingErrorType.RATE_LIMIT:
        return {
          canRecover: true,
          preserveContent: hasPartialContent,
          immediateRetry: false,
          requiresUserAction: false,
          fallbackMode: 'polling'
        };

      case StreamingErrorType.QUOTA_EXCEEDED:
        return {
          canRecover: false,
          preserveContent: hasPartialContent,
          immediateRetry: false,
          requiresUserAction: true,
          fallbackMode: 'offline'
        };

      case StreamingErrorType.MODEL_ERROR:
        return {
          canRecover: true,
          preserveContent: hasPartialContent,
          immediateRetry: true,
          requiresUserAction: false
        };

      case StreamingErrorType.SERVER:
        return {
          canRecover: true,
          preserveContent: hasPartialContent,
          immediateRetry: false,
          requiresUserAction: false,
          fallbackMode: 'polling'
        };

      default:
        return {
          canRecover: false,
          preserveContent: hasPartialContent,
          immediateRetry: false,
          requiresUserAction: true,
          fallbackMode: 'manual'
        };
    }
  }

  // Check if we should retry based on attempt count and error type
  shouldRetry(error: StreamingError): boolean {
    if (!error.retryable) return false;
    
    const attemptCount = this.retryAttempts.get(error.code) || 0;
    return attemptCount < (error.maxRetries || 3);
  }

  // Calculate retry delay with exponential backoff
  getRetryDelay(error: StreamingError): number {
    const attemptCount = this.retryAttempts.get(error.code) || 0;
    const baseDelay = error.retryDelay || 1000;
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attemptCount);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    const maxDelay = 30000; // 30 seconds max
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  // Record a retry attempt
  recordRetryAttempt(error: StreamingError): void {
    const currentAttempts = this.retryAttempts.get(error.code) || 0;
    this.retryAttempts.set(error.code, currentAttempts + 1);
  }

  // Reset retry count for successful operations
  resetRetryCount(errorCode: string): void {
    this.retryAttempts.delete(errorCode);
  }

  // Clear all retry counts
  clearRetryHistory(): void {
    this.retryAttempts.clear();
  }

  // Get error history for debugging
  getErrorHistory(): ReadonlyArray<StreamingError> {
    return [...this.errorHistory];
  }

  // Get recent errors of specific type
  getRecentErrors(type?: StreamingErrorType, minutes = 10): StreamingError[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.errorHistory.filter(error => 
      error.timestamp >= cutoff && 
      (!type || error.type === type)
    );
  }

  // Check if system is in degraded state
  isSystemDegraded(): boolean {
    const recentErrors = this.getRecentErrors(undefined, 5);
    return recentErrors.length >= 3;
  }

  // Get system health status
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'critical';
    errorCount: number;
    lastError?: StreamingError;
    recommendations: string[];
  } {
    const recentErrors = this.getRecentErrors(undefined, 10);
    const criticalErrors = recentErrors.filter(e => 
      e.type === StreamingErrorType.AUTHENTICATION || 
      e.type === StreamingErrorType.QUOTA_EXCEEDED
    );

    let status: 'healthy' | 'degraded' | 'critical';
    const recommendations: string[] = [];

    if (criticalErrors.length > 0) {
      status = 'critical';
      recommendations.push('Immediate user action required');
    } else if (recentErrors.length >= 3) {
      status = 'degraded';
      recommendations.push('Consider switching to fallback mode');
    } else {
      status = 'healthy';
    }

    return {
      status,
      errorCount: recentErrors.length,
      lastError: recentErrors[recentErrors.length - 1],
      recommendations
    };
  }

  // Private helper methods for error classification
  private isConnectionError(message: string): boolean {
    const connectionKeywords = [
      'connection', 'connect', 'socket', 'websocket', 
      'disconnected', 'closed', 'refused', 'unreachable'
    ];
    return connectionKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isAuthenticationError(message: string): boolean {
    const authKeywords = [
      'unauthorized', 'authentication', 'auth', 'login', 
      'token', 'credentials', 'forbidden', '401', '403'
    ];
    return authKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isNetworkError(message: string): boolean {
    const networkKeywords = [
      'network', 'dns', 'resolve', 'host', 'unreachable',
      'net::', 'enotfound', 'econnreset', 'etimedout'
    ];
    return networkKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isTimeoutError(message: string): boolean {
    const timeoutKeywords = ['timeout', 'timed out', 'time out', 'deadline'];
    return timeoutKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isRateLimitError(message: string): boolean {
    const rateLimitKeywords = [
      'rate limit', 'too many requests', 'throttle', 
      '429', 'quota', 'limit exceeded'
    ];
    return rateLimitKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isQuotaError(message: string): boolean {
    const quotaKeywords = [
      'quota exceeded', 'usage limit', 'billing', 
      'payment', 'account limit', 'subscription'
    ];
    return quotaKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isModelError(message: string): boolean {
    const modelKeywords = [
      'model', 'ai error', 'generation failed', 
      'model overloaded', 'inference error'
    ];
    return modelKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isParsingError(message: string): boolean {
    const parsingKeywords = [
      'parse', 'json', 'invalid format', 'malformed', 
      'syntax error', 'decode', 'encoding'
    ];
    return parsingKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private isServerError(message: string): boolean {
    const serverKeywords = [
      'server error', 'internal error', '500', '502', 
      '503', '504', 'service unavailable', 'maintenance'
    ];
    return serverKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private addToHistory(error: StreamingError): void {
    this.errorHistory.push(error);
    
    // Keep history size manageable
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }

    // Log error for debugging
    console.error('[StreamingError]', {
      type: error.type,
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      metadata: error.metadata
    });
  }
}

// Singleton instance for global error handling
export const streamingErrorHandler = new StreamingErrorHandler();

// Utility functions for common error scenarios
export const createStreamingError = (
  type: StreamingErrorType,
  message: string,
  context?: Record<string, any>
): StreamingError => {
  return streamingErrorHandler.classifyError(new Error(message), context);
};

export const handleStreamingError = async (
  error: Error | string,
  partialContent?: string,
  onRetry?: () => Promise<void>
): Promise<ErrorRecoveryStrategy> => {
  const streamingError = streamingErrorHandler.classifyError(error);
  const strategy = streamingErrorHandler.getRecoveryStrategy(streamingError, partialContent);

  // Record retry attempt if we're going to retry
  if (strategy.immediateRetry && onRetry) {
    streamingErrorHandler.recordRetryAttempt(streamingError);
    
    if (streamingErrorHandler.shouldRetry(streamingError)) {
      const delay = streamingErrorHandler.getRetryDelay(streamingError);
      
      setTimeout(async () => {
        try {
          await onRetry();
          streamingErrorHandler.resetRetryCount(streamingError.code);
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }, delay);
    }
  }

  return strategy;
};

// Reactive error state management
import { writable, derived } from 'svelte/store';

export const errorState = writable<{
  currentError?: StreamingError;
  isRetrying: boolean;
  retryCount: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
}>({
  isRetrying: false,
  retryCount: 0,
  systemHealth: 'healthy'
});

export const hasActiveError = derived(
  errorState,
  $state => Boolean($state.currentError)
);

export const canRetry = derived(
  errorState,
  $state => Boolean($state.currentError?.retryable && !$state.isRetrying)
);

// Update error state
export const setError = (error: StreamingError) => {
  errorState.update(state => ({
    ...state,
    currentError: error,
    systemHealth: streamingErrorHandler.getSystemHealth().status
  }));
};

export const clearError = () => {
  errorState.update(state => ({
    ...state,
    currentError: undefined,
    isRetrying: false,
    retryCount: 0
  }));
};

export const setRetrying = (isRetrying: boolean, retryCount = 0) => {
  errorState.update(state => ({
    ...state,
    isRetrying,
    retryCount
  }));
}; 