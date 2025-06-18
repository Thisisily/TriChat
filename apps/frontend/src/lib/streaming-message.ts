import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { streamingService, streamingActions, type StreamMessage } from './streaming';

// Types for streaming message state
export interface StreamingMessageState {
  content: string;
  isStreaming: boolean;
  isComplete: boolean;
  isError: boolean;
  error?: string;
  messageId?: string;
  threadId?: string;
  tokens: string[];
  metadata?: {
    model?: string;
    provider?: string;
    tokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

export interface StreamingMessageConfig {
  messageId?: string;
  threadId?: string;
  autoStart?: boolean;
  onComplete?: (content: string) => void;
  onError?: (error: string) => void;
  onToken?: (token: string) => void;
}

// Create a streaming message manager
export function createStreamingMessage(config: StreamingMessageConfig = {}) {
  // Core state
  const state: Writable<StreamingMessageState> = writable({
    content: '',
    isStreaming: false,
    isComplete: false,
    isError: false,
    tokens: [],
    messageId: config.messageId,
    threadId: config.threadId,
  });

  // Derived stores for convenience
  const content: Readable<string> = derived(state, $state => $state.content);
  const isStreaming: Readable<boolean> = derived(state, $state => $state.isStreaming);
  const isComplete: Readable<boolean> = derived(state, $state => $state.isComplete);
  const isError: Readable<boolean> = derived(state, $state => $state.isError);
  const tokens: Readable<string[]> = derived(state, $state => $state.tokens);

  // Track message handlers for cleanup
  let unsubscribeHandlers: (() => void)[] = [];

  // Core methods
  const appendToken = (token: string) => {
    state.update(currentState => {
      const newTokens = [...currentState.tokens, token];
      const newContent = currentState.content + token;
      
      config.onToken?.(token);
      
      return {
        ...currentState,
        content: newContent,
        tokens: newTokens,
      };
    });
  };

  const setComplete = (finalContent?: string, metadata?: StreamingMessageState['metadata']) => {
    state.update(currentState => {
      const content = finalContent || currentState.content;
      config.onComplete?.(content);
      
      return {
        ...currentState,
        content,
        isStreaming: false,
        isComplete: true,
        metadata: metadata || currentState.metadata,
      };
    });
  };

  const setError = (error: string) => {
    state.update(currentState => {
      config.onError?.(error);
      
      return {
        ...currentState,
        isStreaming: false,
        isError: true,
        error,
      };
    });
  };

  const reset = () => {
    state.set({
      content: '',
      isStreaming: false,
      isComplete: false,
      isError: false,
      tokens: [],
      messageId: config.messageId,
      threadId: config.threadId,
    });
  };

  const startStreaming = (messageId?: string, threadId?: string) => {
    // Reset state
    reset();
    
    // Update IDs if provided
    if (messageId || threadId) {
      state.update(currentState => ({
        ...currentState,
        messageId: messageId || currentState.messageId,
        threadId: threadId || currentState.threadId,
        isStreaming: true,
      }));
    } else {
      state.update(currentState => ({
        ...currentState,
        isStreaming: true,
      }));
    }

    // Set up message handlers
    setupMessageHandlers();
  };

  const stopStreaming = () => {
    state.update(currentState => ({
      ...currentState,
      isStreaming: false,
    }));
    
    cleanupHandlers();
  };

  const setupMessageHandlers = () => {
    // Clean up existing handlers
    cleanupHandlers();

    // Handle streaming chat responses
    const unsubscribeResponse = streamingActions.onChatResponse((message: StreamMessage) => {
      // Check if this message is for our stream
      const currentState = getCurrentState();
      if (message.threadId !== currentState.threadId && message.data.messageId !== currentState.messageId) {
        return;
      }

      // Handle delta/token updates
      if (message.data.delta && typeof message.data.delta === 'string') {
        appendToken(message.data.delta);
      } else if (message.data.content && typeof message.data.content === 'string') {
        // Handle full content updates
        state.update(currentState => ({
          ...currentState,
          content: message.data.content as string,
        }));
      }
    });

    // Handle completion
    const unsubscribeComplete = streamingActions.onChatComplete((message: StreamMessage) => {
      const currentState = getCurrentState();
      if (message.threadId !== currentState.threadId && message.data.messageId !== currentState.messageId) {
        return;
      }

      const finalContent = (message.data.content as string) || currentState.content;
      const metadata = message.data.metadata as StreamingMessageState['metadata'];
      
      setComplete(finalContent, metadata);
    });

    // Handle errors
    const unsubscribeError = streamingService.on('error', (message: StreamMessage) => {
      const currentState = getCurrentState();
      if (message.threadId !== currentState.threadId && message.data.messageId !== currentState.messageId) {
        return;
      }

      const errorMessage = (message.data.error as string) || 'Streaming failed';
      setError(errorMessage);
    });

    // Store handlers for cleanup
    unsubscribeHandlers = [unsubscribeResponse, unsubscribeComplete, unsubscribeError];
  };

  const cleanupHandlers = () => {
    unsubscribeHandlers.forEach(unsub => unsub());
    unsubscribeHandlers = [];
  };

  const getCurrentState = (): StreamingMessageState => {
    let currentState: StreamingMessageState;
    state.subscribe(s => currentState = s)();
    return currentState!;
  };

  // Auto-start if configured
  if (config.autoStart) {
    startStreaming();
  }

  // Return the public API
  return {
    // Stores
    state,
    content,
    isStreaming,
    isComplete,
    isError,
    tokens,

    // Methods
    appendToken,
    setComplete,
    setError,
    reset,
    startStreaming,
    stopStreaming,
    getCurrentState,

    // Cleanup
    destroy: cleanupHandlers,
  };
}

// Helper function for Trinity Mode streaming
export function createTrinityStreamingMessage(config: StreamingMessageConfig = {}) {
  const baseManager = createStreamingMessage(config);
  
  // Trinity-specific state
  const trinityState = writable({
    agentResponses: [] as Array<{
      agentType: 'analytical' | 'creative' | 'factual';
      content: string;
      confidence: number;
      metadata?: any;
    }>,
    orchestratorActive: false,
    executionMode: 'parallel' as 'parallel' | 'sequential' | 'hybrid',
  });

  // Handle Trinity-specific events
  const handleTrinityEvents = () => {
    // Handle agent responses
    const unsubAgent = streamingService.on('agent_complete', (message: StreamMessage) => {
      const currentState = baseManager.getCurrentState();
      if (message.threadId !== currentState.threadId) return;

      const agentData = message.data as {
        agentType: 'analytical' | 'creative' | 'factual';
        content: string;
        metadata?: any;
      };

      trinityState.update(state => ({
        ...state,
        agentResponses: [...state.agentResponses, {
          agentType: agentData.agentType,
          content: agentData.content,
          confidence: agentData.metadata?.confidence || 0.8,
          metadata: agentData.metadata,
        }],
      }));
    });

    // Handle orchestrator start
    const unsubOrchestrator = streamingService.on('orchestrator_chunk', (message: StreamMessage) => {
      const currentState = baseManager.getCurrentState();
      if (message.threadId !== currentState.threadId) return;

      trinityState.update(state => ({
        ...state,
        orchestratorActive: true,
      }));

      // Pass through to base manager for content updates
      if (message.data.delta && typeof message.data.delta === 'string') {
        baseManager.appendToken(message.data.delta);
      }
    });

    return [unsubAgent, unsubOrchestrator];
  };

  const trinityUnsubscribers = handleTrinityEvents();

  return {
    ...baseManager,
    
    // Trinity-specific stores
    trinityState,
    agentResponses: derived(trinityState, $state => $state.agentResponses),
    orchestratorActive: derived(trinityState, $state => $state.orchestratorActive),
    
    // Enhanced destroy method
    destroy: () => {
      baseManager.destroy();
      trinityUnsubscribers.forEach(unsub => unsub());
    },
  };
}

// Export for legacy compatibility
export const streamingMessageActions = {
  createStreamingMessage,
  createTrinityStreamingMessage,
}; 