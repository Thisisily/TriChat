<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { marked } from 'marked';
  import { 
    currentMessages, 
    currentThread, 
    messagesLoading, 
    messagesError,
    hasMoreMessages,
    messageActions,
    type Message 
  } from '../stores/threads';
  import { 
    streamMessages, 
    streamingActions, 
    connectionStatus,
    type StreamMessage 
  } from '../streaming';
  import { currentUser } from '../stores/auth';

  // Component state
  let messagesContainer: HTMLElement;
  let shouldAutoScroll = true;
  let isNearBottom = true;

  // Configure marked for security and performance
  marked.setOptions({
    breaks: true,
    gfm: true,
    sanitize: false, // We'll handle sanitization separately if needed
  });

  // Auto-scroll behavior
  function scrollToBottom() {
    if (messagesContainer && shouldAutoScroll) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function checkScrollPosition() {
    if (!messagesContainer) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const threshold = 100; // pixels from bottom
    
    isNearBottom = scrollHeight - scrollTop - clientHeight < threshold;
    shouldAutoScroll = isNearBottom;
  }

  // Handle streaming messages
  function handleStreamingMessage(streamMsg: StreamMessage) {
    if (streamMsg.type === 'chat_response' || streamMsg.type === 'chat_complete') {
      // Update the last message if it's from the assistant
      currentMessages.update(messages => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          return [
            ...messages.slice(0, -1),
            {
              ...lastMessage,
              content: streamMsg.data.content as string || lastMessage.content,
            }
          ];
        }
        return messages;
      });
      
      // Auto-scroll for streaming updates
      if (shouldAutoScroll) {
        setTimeout(scrollToBottom, 10);
      }
    }
  }

  // Load more messages when scrolled to top
  async function handleLoadMore() {
    if ($messagesLoading || !$hasMoreMessages) return;
    
    const scrollHeight = messagesContainer.scrollHeight;
    await messageActions.loadMoreMessages();
    
    // Maintain scroll position after loading more messages
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight - scrollHeight;
      }
    }, 10);
  }

  function handleScroll() {
    checkScrollPosition();
    
    // Load more messages when near top
    if (messagesContainer.scrollTop < 100 && $hasMoreMessages && !$messagesLoading) {
      handleLoadMore();
    }
  }

  // Format message content with markdown
  function formatMessageContent(content: string): string {
    try {
      return marked(content);
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return content; // Fallback to plain text
    }
  }

  // Format timestamp
  function formatTimestamp(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }

  // Get message status indicator
  function getMessageStatus(message: Message): string {
    // This would be enhanced with actual status from the backend
    return 'sent';
  }

  // Subscribe to streaming messages
  let unsubscribeStreaming: (() => void) | null = null;

  onMount(() => {
    // Subscribe to streaming messages for live updates
    unsubscribeStreaming = streamingActions.onChatResponse(handleStreamingMessage);
    
    // Initial scroll to bottom
    setTimeout(scrollToBottom, 100);
  });

  onDestroy(() => {
    if (unsubscribeStreaming) {
      unsubscribeStreaming();
    }
  });

  // Scroll to bottom when new messages arrive
  afterUpdate(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  });

  // Reactive statements
  $: if ($currentMessages.length > 0 && shouldAutoScroll) {
    setTimeout(scrollToBottom, 10);
  }
</script>

<div class="chat-panel">
  <!-- Header -->
  {#if $currentThread}
    <div class="chat-header">
      <div class="thread-info">
        <h2 class="thread-title">{$currentThread.title}</h2>
        <div class="thread-meta">
          <span class="message-count">
            {$currentMessages.length} message{$currentMessages.length !== 1 ? 's' : ''}
          </span>
          {#if $connectionStatus.state === 'connected'}
            <span class="connection-status connected">
              🟢 {$connectionStatus.type}
            </span>
          {:else}
            <span class="connection-status disconnected">
              🔴 {$connectionStatus.state}
            </span>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Messages Container -->
  <div 
    class="messages-container" 
    bind:this={messagesContainer}
    on:scroll={handleScroll}
  >
    <!-- Loading indicator for pagination -->
    {#if $messagesLoading && $hasMoreMessages}
      <div class="loading-more">
        <div class="spinner"></div>
        <span>Loading more messages...</span>
      </div>
    {/if}

    <!-- Error state -->
    {#if $messagesError}
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <span>{$messagesError}</span>
        <button 
          class="retry-button" 
          on:click={() => $currentThread && messageActions.loadMessages($currentThread.id)}
        >
          Retry
        </button>
      </div>
    {/if}

    <!-- Messages -->
    {#if $currentMessages.length > 0}
      {#each $currentMessages as message (message.id)}
        <div class="message {message.role}">
          <div class="message-avatar">
            {#if message.role === 'user'}
              <div class="avatar user-avatar">
                {message.user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            {:else if message.role === 'assistant'}
              <div class="avatar assistant-avatar">🤖</div>
            {:else}
              <div class="avatar system-avatar">⚙️</div>
            {/if}
          </div>
          
          <div class="message-content">
            <div class="message-header">
              <span class="message-author">
                {#if message.role === 'user'}
                  {message.user?.username || 'You'}
                {:else if message.role === 'assistant'}
                  {message.model ? `AI (${message.model})` : 'AI Assistant'}
                {:else}
                  System
                {/if}
              </span>
              <span class="message-timestamp">
                {formatTimestamp(new Date(message.createdAt))}
              </span>
              {#if message.role === 'user'}
                <span class="message-status {getMessageStatus(message)}">
                  {#if getMessageStatus(message) === 'sending'}
                    <div class="status-spinner"></div>
                  {:else if getMessageStatus(message) === 'sent'}
                    ✓
                  {:else if getMessageStatus(message) === 'error'}
                    ⚠️
                  {/if}
                </span>
              {/if}
            </div>
            
            <div class="message-text">
              {@html formatMessageContent(message.content)}
            </div>
            
            {#if message.provider && message.role === 'assistant'}
              <div class="message-provider">
                via {message.provider}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {:else if !$messagesLoading}
      <!-- Empty state -->
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <h3>Start a conversation</h3>
        <p>Send a message to begin chatting with AI assistants.</p>
      </div>
    {/if}

    <!-- Loading state for initial load -->
    {#if $messagesLoading && $currentMessages.length === 0}
      <div class="loading-initial">
        <div class="spinner"></div>
        <span>Loading messages...</span>
      </div>
    {/if}
  </div>

  <!-- Scroll to bottom button -->
  {#if !isNearBottom && $currentMessages.length > 0}
    <button 
      class="scroll-to-bottom"
      on:click={() => {
        shouldAutoScroll = true;
        scrollToBottom();
      }}
    >
      ↓ New messages
    </button>
  {/if}
</div>

<style>
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    position: relative;
  }

  .chat-header {
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .thread-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .thread-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .thread-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: #6b7280;
  }

  .connection-status {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }

  .connection-status.connected {
    background: #d1fae5;
    color: #065f46;
  }

  .connection-status.disconnected {
    background: #fee2e2;
    color: #991b1b;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    scroll-behavior: smooth;
  }

  .loading-more, .loading-initial {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    color: #6b7280;
    font-size: 14px;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #991b1b;
    margin-bottom: 16px;
  }

  .retry-button {
    background: #dc2626;
    color: white;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    margin-left: auto;
  }

  .retry-button:hover {
    background: #b91c1c;
  }

  .message {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    align-items: flex-start;
  }

  .message.system {
    background: #f3f4f6;
    padding: 12px;
    border-radius: 8px;
    border-left: 4px solid #6b7280;
  }

  .message-avatar {
    flex-shrink: 0;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
  }

  .user-avatar {
    background: #3b82f6;
    color: white;
  }

  .assistant-avatar {
    background: #10b981;
    color: white;
  }

  .system-avatar {
    background: #6b7280;
    color: white;
  }

  .message-content {
    flex: 1;
    min-width: 0;
  }

  .message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .message-author {
    font-weight: 600;
    font-size: 14px;
    color: #374151;
  }

  .message-timestamp {
    font-size: 12px;
    color: #9ca3af;
  }

  .message-status {
    font-size: 12px;
    margin-left: auto;
  }

  .message-text {
    color: #111827;
    line-height: 1.6;
    word-wrap: break-word;
  }

  /* Markdown styling */
  .message-text :global(p) {
    margin: 0 0 8px 0;
  }

  .message-text :global(p:last-child) {
    margin-bottom: 0;
  }

  .message-text :global(pre) {
    background: #f3f4f6;
    border-radius: 6px;
    padding: 12px;
    overflow-x: auto;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    margin: 8px 0;
  }

  .message-text :global(code) {
    background: #f3f4f6;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 13px;
  }

  .message-text :global(pre code) {
    background: none;
    padding: 0;
  }

  .message-text :global(blockquote) {
    border-left: 4px solid #d1d5db;
    padding-left: 12px;
    margin: 8px 0;
    color: #6b7280;
  }

  .message-provider {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 4px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: #6b7280;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    color: #374151;
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  .scroll-to-bottom {
    position: absolute;
    bottom: 20px;
    right: 20px;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    animation: bounce 2s infinite;
  }

  .scroll-to-bottom:hover {
    background: #2563eb;
  }

  .spinner, .status-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #f3f4f6;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .status-spinner {
    width: 12px;
    height: 12px;
    border-width: 1px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-4px);
    }
    60% {
      transform: translateY(-2px);
    }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .chat-panel {
      background: #1f2937;
      color: #f9fafb;
    }

    .chat-header {
      background: #111827;
      border-bottom-color: #374151;
    }

    .thread-title {
      color: #f9fafb;
    }

    .message-author {
      color: #d1d5db;
    }

    .message-text {
      color: #f9fafb;
    }

    .message-text :global(pre),
    .message-text :global(code) {
      background: #374151;
    }

    .empty-state h3 {
      color: #d1d5db;
    }

    .message.system {
      background: #374151;
    }
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .chat-header {
      padding: 12px 16px;
    }

    .messages-container {
      padding: 12px 16px;
    }

    .thread-title {
      font-size: 16px;
    }

    .thread-meta {
      font-size: 11px;
    }

    .message {
      gap: 8px;
    }

    .avatar {
      width: 28px;
      height: 28px;
      font-size: 12px;
    }

    .scroll-to-bottom {
      bottom: 16px;
      right: 16px;
      padding: 6px 12px;
    }
  }
</style> 