<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { 
    threads, 
    sortedThreads, 
    currentThread, 
    threadsLoading, 
    threadsError,
    threadActions,
    type Thread 
  } from '../stores';
  import { isAuthenticated } from '../stores';

  // Component state
  let searchQuery = '';
  let isCreatingThread = false;
  let newThreadTitle = '';
  let searchInput: HTMLInputElement;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    threadSelect: { threadId: string };
    threadCreate: { title: string };
    threadDelete: { threadId: string };
    threadRename: { threadId: string; title: string };
  }>();

  // Filtered and sorted threads
  $: filteredThreads = $sortedThreads.filter(thread => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return thread.title.toLowerCase().includes(query) ||
           thread.lastMessage?.content.toLowerCase().includes(query);
  });

  // Thread selection
  async function selectThread(thread: Thread) {
    dispatch('threadSelect', { threadId: thread.id });
  }

  // Thread creation
  async function startCreatingThread() {
    isCreatingThread = true;
    newThreadTitle = '';
    setTimeout(() => {
      const input = document.querySelector('.create-input') as HTMLInputElement;
      input?.focus();
    }, 50);
  }

  async function createThread() {
    if (!newThreadTitle.trim()) return;
    
    try {
      const thread = await threadActions.createThread(newThreadTitle.trim());
      
      isCreatingThread = false;
      newThreadTitle = '';
      
      dispatch('threadCreate', { title: thread.title });
    } catch (error) {
      console.error('Failed to create thread:', error);
    }
  }

  function cancelCreateThread() {
    isCreatingThread = false;
    newThreadTitle = '';
  }

  // Format timestamp
  function formatTimestamp(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    
    return date.toLocaleDateString();
  }

  // Format last message preview
  function formatLastMessage(thread: Thread): string {
    if (!thread.lastMessage) return 'No messages yet';
    
    const content = thread.lastMessage.content.replace(/\n/g, ' ').trim();
    const maxLength = 60;
    
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  // Initialize
  onMount(() => {
    if ($isAuthenticated) {
      threadActions.loadThreads();
    }
  });
</script>

<div class="thread-list">
  <!-- Header -->
  <div class="thread-list-header">
    <div class="header-content">
      <h3 class="header-title">
        Conversations
        {#if $threads.length > 0}
          <span class="thread-count">({$threads.length})</span>
        {/if}
      </h3>
      
      <button 
        class="create-button"
        on:click={startCreatingThread}
        disabled={!$isAuthenticated || isCreatingThread}
        title="Start new conversation"
      >
        ✚
      </button>
    </div>

    <!-- Search -->
    <div class="search-container">
      <input
        bind:this={searchInput}
        bind:value={searchQuery}
        type="text"
        placeholder="Search conversations..."
        class="search-input"
      />
      {#if searchQuery}
        <button class="clear-search" on:click={() => { searchQuery = ''; searchInput?.focus(); }}>
          ×
        </button>
      {:else}
        <span class="search-icon">🔍</span>
      {/if}
    </div>
  </div>

  <!-- Content -->
  <div class="thread-list-content">
    {#if !$isAuthenticated}
      <!-- Not authenticated state -->
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <p>Sign in to view your conversations</p>
      </div>
      
    {:else if $threadsLoading}
      <!-- Loading state -->
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading conversations...</p>
      </div>
      
    {:else if $threadsError}
      <!-- Error state -->
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <p>{$threadsError}</p>
        <button class="retry-button" on:click={() => threadActions.loadThreads()}>
          Retry
        </button>
      </div>
      
    {:else}
      <!-- Thread creation input -->
      {#if isCreatingThread}
        <div class="create-thread-form">
          <input
            bind:value={newThreadTitle}
            type="text"
            placeholder="Conversation title..."
            class="create-input"
            maxlength="100"
            on:keydown={(e) => {
              if (e.key === 'Enter') createThread();
              if (e.key === 'Escape') cancelCreateThread();
            }}
          />
          <div class="create-actions">
            <button class="create-save" on:click={createThread} disabled={!newThreadTitle.trim()}>
              Create
            </button>
            <button class="create-cancel" on:click={cancelCreateThread}>
              Cancel
            </button>
          </div>
        </div>
      {/if}

      <!-- Thread list -->
      {#if filteredThreads.length > 0}
        <div class="threads">
          {#each filteredThreads as thread (thread.id)}
            <div 
              class="thread-item"
              class:active={$currentThread?.id === thread.id}
              on:click={() => selectThread(thread)}
              on:keydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectThread(thread);
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Select conversation: {thread.title}"
            >
              <div class="thread-content">
                <div class="thread-header">
                  <h4 class="thread-title">{thread.title}</h4>
                  <span class="thread-time">{formatTimestamp(new Date(thread.updatedAt))}</span>
                </div>
                
                <div class="thread-preview">
                  <span class="last-message">{formatLastMessage(thread)}</span>
                  {#if thread.messageCount}
                    <span class="message-count">{thread.messageCount} message{thread.messageCount !== 1 ? 's' : ''}</span>
                  {/if}
                </div>
                
                {#if thread.isPublic}
                  <div class="thread-badges">
                    <span class="public-badge">Public</span>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else if searchQuery}
        <!-- No search results -->
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No conversations found</p>
          <button class="clear-search-button" on:click={() => { searchQuery = ''; searchInput?.focus(); }}>
            Clear search
          </button>
        </div>
      {:else if $threads.length === 0}
        <!-- No threads yet -->
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>No conversations yet</p>
          <p class="empty-subtitle">Start a new conversation to get started</p>
          <button class="start-conversation" on:click={startCreatingThread}>
            Start Conversation
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .thread-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: white;
    border-right: 1px solid #e5e7eb;
    width: 100%;
    overflow: hidden;
  }

  .thread-list-header {
    padding: 16px 16px 12px 16px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .thread-count {
    font-size: 14px;
    color: #6b7280;
    font-weight: 400;
  }

  .create-button {
    background: #667eea;
    color: white;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .create-button:hover:not(:disabled) {
    background: #5a67d8;
    transform: scale(1.05);
  }

  .create-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .search-container {
    position: relative;
  }

  .search-input {
    width: 100%;
    padding: 8px 32px 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .clear-search, .search-icon {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: #6b7280;
    padding: 4px;
  }

  .clear-search:hover {
    color: #374151;
  }

  .thread-list-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .create-thread-form {
    padding: 12px 16px;
    border-bottom: 1px solid #f3f4f6;
    background: #f9fafb;
  }

  .create-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .create-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .create-actions {
    display: flex;
    gap: 8px;
  }

  .create-save, .create-cancel {
    padding: 6px 12px;
    border: 1px solid;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .create-save {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }

  .create-save:hover:not(:disabled) {
    background: #5a67d8;
    border-color: #5a67d8;
  }

  .create-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .create-cancel {
    background: white;
    color: #6b7280;
    border-color: #d1d5db;
  }

  .create-cancel:hover {
    background: #f3f4f6;
  }

  .threads {
    padding: 0 8px;
  }

  .thread-item {
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 4px;
    border: 1px solid transparent;
  }

  .thread-item:hover {
    background: #f9fafb;
    border-color: #e5e7eb;
  }

  .thread-item.active {
    background: #eff6ff;
    border-color: #dbeafe;
    box-shadow: 0 1px 3px rgba(59, 130, 246, 0.1);
  }

  .thread-content {
    width: 100%;
  }

  .thread-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
  }

  .thread-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    margin: 0;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
  }

  .thread-time {
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
  }

  .thread-preview {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .last-message {
    font-size: 13px;
    color: #6b7280;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
  }

  .message-count {
    font-size: 11px;
    color: #9ca3af;
    white-space: nowrap;
  }

  .thread-badges {
    margin-top: 4px;
  }

  .public-badge {
    background: #dbeafe;
    color: #1e40af;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }

  .empty-state, .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
    color: #6b7280;
  }

  .empty-icon, .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state p, .loading-state p, .error-state p {
    margin: 0 0 8px 0;
    font-size: 14px;
  }

  .empty-subtitle {
    font-size: 13px !important;
    color: #9ca3af !important;
  }

  .start-conversation, .retry-button, .clear-search-button {
    background: #667eea;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    margin-top: 12px;
    transition: all 0.2s ease;
  }

  .start-conversation:hover, .retry-button:hover, .clear-search-button:hover {
    background: #5a67d8;
    transform: translateY(-1px);
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #e5e7eb;
    border-top: 2px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .thread-list {
      background: #1f2937;
      border-color: #374151;
    }

    .thread-list-header {
      background: #111827;
      border-color: #374151;
    }

    .header-title {
      color: #f9fafb;
    }

    .thread-count {
      color: #9ca3af;
    }

    .search-input {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }

    .create-input {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }

    .create-thread-form {
      background: #111827;
      border-color: #374151;
    }

    .thread-item:hover {
      background: #374151;
      border-color: #4b5563;
    }

    .thread-item.active {
      background: #1e3a8a;
      border-color: #3b82f6;
    }

    .thread-title {
      color: #f9fafb;
    }

    .thread-time, .last-message {
      color: #9ca3af;
    }

    .message-count {
      color: #6b7280;
    }

    .empty-state, .loading-state, .error-state {
      color: #9ca3af;
    }

    .loading-spinner {
      border-color: #4b5563;
      border-top-color: #667eea;
    }
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .thread-list {
      width: 100%;
    }

    .thread-list-header {
      padding: 12px;
    }

    .create-thread-form {
      padding: 12px;
    }

    .thread-item {
      padding: 16px 12px;
    }

    .thread-title {
      font-size: 15px;
    }

    .last-message {
      font-size: 14px;
    }
  }
</style> 