<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    connectionStatus, 
    streamMessages, 
    presenceUsers,
    streamingActions,
    type StreamMessage,
    type ConnectionState 
  } from '../streaming';
  import { isAuthenticated, currentUser } from '../stores';

  let testMessage = '';
  let testThreadId = 'test-thread-123';
  let testContent = 'Hello, this is a streaming test message!';
  let messageLog: StreamMessage[] = [];
  let autoScroll = true;
  let messageContainer: HTMLElement;

  // Reactive statements
  $: connectionState = $connectionStatus.state;
  $: isConnected = connectionState === 'connected';
  $: onlineUsers = Array.from($presenceUsers);

  // Subscribe to stream messages
  $: {
    messageLog = $streamMessages.slice(-50); // Keep last 50 messages
    if (autoScroll && messageContainer) {
      // Use setTimeout to avoid blocking the main thread
      setTimeout(() => {
        messageContainer.scrollTop = messageContainer.scrollHeight;
      }, 100);
    }
  }

  // Connection status styling
  function getStatusColor(state: ConnectionState): string {
    switch (state) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'reconnecting': return 'text-orange-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-500';
    }
  }

  function getConnectionIcon(type: string | null): string {
    switch (type) {
      case 'websocket': return '🔌';
      case 'sse': return '📡';
      default: return '❌';
    }
  }

  // Event handlers
  function handleConnect() {
    streamingActions.connect();
  }

  function handleDisconnect() {
    streamingActions.disconnect();
  }

  function handleSendMessage() {
    if (!testMessage.trim()) return;
    
    const success = streamingActions.sendChatMessage(testThreadId, testMessage);
    if (!success) {
      console.warn('Failed to send message - not connected via WebSocket');
    }
    testMessage = '';
  }

  function handlePresenceUpdate(status: 'online' | 'offline' | 'typing') {
    streamingActions.updatePresence(status, testThreadId);
  }

  async function handleTestStreaming() {
    if (!$currentUser) {
      console.error('No authenticated user');
      return;
    }

    try {
      // Test the streaming endpoint
      const response = await fetch(`${import.meta.env.VITE_API_URL}/stream/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: $currentUser.id,
          threadId: testThreadId,
          messageId: `msg_${Date.now()}`,
          content: testContent,
          model: 'gpt-4o',
          provider: 'openai',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Streaming test result:', result);
    } catch (error) {
      console.error('Streaming test failed:', error);
    }
  }

  function clearMessages() {
    messageLog = [];
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  function formatMessageData(data: any): string {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  }

  // Setup event listeners
  onMount(() => {
    // Auto-connect if authenticated
    if ($isAuthenticated) {
      setTimeout(() => {
        streamingActions.connect();
      }, 1000);
    }
  });

  onDestroy(() => {
    streamingActions.disconnect();
  });
</script>

<div class="streaming-test p-6 max-w-4xl mx-auto">
  <h2 class="text-2xl font-bold mb-6">🚀 Streaming Test Dashboard</h2>

  <!-- Connection Status -->
  <div class="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border">
    <h3 class="text-lg font-semibold mb-3">Connection Status</h3>
    
    <div class="flex items-center gap-4 mb-4">
      <div class="flex items-center gap-2">
        <span class="text-2xl">{getConnectionIcon($connectionStatus.type)}</span>
        <span class="font-medium">
          {$connectionStatus.type?.toUpperCase() || 'DISCONNECTED'}
        </span>
        <span class={`font-bold ${getStatusColor($connectionStatus.state)}`}>
          {$connectionStatus.state.toUpperCase()}
        </span>
      </div>

      {#if $connectionStatus.latency}
        <span class="text-sm text-gray-600">
          Latency: {$connectionStatus.latency}ms
        </span>
      {/if}

      {#if $connectionStatus.reconnectAttempts > 0}
        <span class="text-sm text-orange-600">
          Reconnect attempts: {$connectionStatus.reconnectAttempts}
        </span>
      {/if}
    </div>

    {#if $connectionStatus.error}
      <div class="bg-red-50 border border-red-200 rounded p-3 text-red-800 mb-4">
        <strong>Error:</strong> {$connectionStatus.error}
      </div>
    {/if}

    <div class="flex gap-2">
      <button 
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        on:click={handleConnect}
        disabled={isConnected}
      >
        Connect
      </button>
      
      <button 
        class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        on:click={handleDisconnect}
        disabled={!isConnected}
      >
        Disconnect
      </button>
    </div>
  </div>

  <!-- Presence Status -->
  <div class="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border">
    <h3 class="text-lg font-semibold mb-3">Online Users ({onlineUsers.length})</h3>
    
    <div class="flex flex-wrap gap-2 mb-4">
      {#each onlineUsers as userId}
        <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
          🟢 {userId}
        </span>
      {/each}
      
      {#if onlineUsers.length === 0}
        <span class="text-gray-500 italic">No users online</span>
      {/if}
    </div>

    <div class="flex gap-2">
      <button 
        class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        on:click={() => handlePresenceUpdate('online')}
        disabled={!isConnected || $connectionStatus.type !== 'websocket'}
      >
        Go Online
      </button>
      
      <button 
        class="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
        on:click={() => handlePresenceUpdate('typing')}
        disabled={!isConnected || $connectionStatus.type !== 'websocket'}
      >
        Typing
      </button>
      
      <button 
        class="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        on:click={() => handlePresenceUpdate('offline')}
        disabled={!isConnected || $connectionStatus.type !== 'websocket'}
      >
        Go Offline
      </button>
    </div>
  </div>

  <!-- Message Testing -->
  <div class="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border">
    <h3 class="text-lg font-semibold mb-3">Message Testing</h3>
    
         <!-- Send Chat Message -->
     <div class="mb-4">
       <label for="test-message-input" class="block text-sm font-medium mb-2">Send Chat Message (WebSocket only)</label>
       <div class="flex gap-2">
         <input 
           id="test-message-input"
           type="text"
           bind:value={testMessage}
           placeholder="Type a message..."
           class="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
           on:keydown={(e) => e.key === 'Enter' && handleSendMessage()}
         />
         <button 
           class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
           on:click={handleSendMessage}
           disabled={!isConnected || $connectionStatus.type !== 'websocket'}
         >
           Send
         </button>
       </div>
     </div>

         <!-- Test Streaming Response -->
     <div class="mb-4">
       <label for="test-content-input" class="block text-sm font-medium mb-2">Test LLM Streaming Response</label>
       <div class="flex gap-2">
         <input 
           id="test-content-input"
           type="text"
           bind:value={testContent}
           placeholder="Content to stream..."
           class="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
         />
         <button 
           class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
           on:click={handleTestStreaming}
           disabled={!isConnected || !$isAuthenticated}
         >
           Test Streaming
         </button>
       </div>
     </div>

    <div class="text-sm text-gray-600 mb-2">
      Thread ID: <code class="bg-gray-100 px-2 py-1 rounded">{testThreadId}</code>
    </div>
  </div>

  <!-- Message Log -->
  <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border">
    <div class="flex justify-between items-center mb-3">
      <h3 class="text-lg font-semibold">Message Log ({messageLog.length})</h3>
      
      <div class="flex gap-2">
        <label class="flex items-center text-sm">
          <input 
            type="checkbox"
            bind:checked={autoScroll}
            class="mr-2"
          />
          Auto-scroll
        </label>
        
        <button 
          class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          on:click={clearMessages}
        >
          Clear
        </button>
      </div>
    </div>

    <div 
      bind:this={messageContainer}
      class="h-96 overflow-y-auto border rounded p-3 bg-gray-50 dark:bg-gray-900 space-y-2"
    >
      {#each messageLog as message}
        <div class="bg-white dark:bg-gray-800 rounded p-3 border-l-4 border-blue-500">
          <div class="flex justify-between items-start mb-2">
            <div class="flex items-center gap-2">
              <span class="font-medium text-blue-600">{message.type}</span>
              {#if message.userId}
                <span class="text-sm text-gray-600">from {message.userId}</span>
              {/if}
              {#if message.threadId}
                <span class="text-sm text-gray-600">in {message.threadId}</span>
              {/if}
            </div>
            <span class="text-xs text-gray-500">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
          
          <div class="text-sm">
            <strong>ID:</strong> <code class="text-xs">{message.id}</code>
          </div>
          
          {#if message.data && Object.keys(message.data).length > 0}
            <div class="mt-2">
              <strong class="text-sm">Data:</strong>
              <pre class="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 overflow-x-auto">{formatMessageData(message.data)}</pre>
            </div>
          {/if}
        </div>
      {/each}
      
      {#if messageLog.length === 0}
        <div class="text-center text-gray-500 py-8">
          No messages yet. Connect and start testing!
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .streaming-test {
    font-family: system-ui, -apple-system, sans-serif;
  }
</style> 