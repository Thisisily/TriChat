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
  import ThreadSkeleton from './ThreadSkeleton.svelte';

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
        <ThreadSkeleton count={5} />
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
                  {#if thread.messageCount !== undefined && thread.messageCount !== null}
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
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.15),
      rgba(0, 0, 0, 0.08)
    );
    backdrop-filter: blur(20px) saturate(160%);
    border-right: 1px solid rgba(255, 255, 255, 0.15);
    width: 100%;
    overflow: hidden;
  }

  .thread-list-header {
    padding: 16px 16px 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(16px);
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
    color: rgba(255, 255, 255, 0.95);
    margin: 0;
  }

  .thread-count {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 400;
  }

  .create-button {
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.25),
      rgba(118, 75, 162, 0.15)
    );
    backdrop-filter: blur(12px) saturate(150%);
    color: white;
    border: 1px solid rgba(102, 126, 234, 0.3);
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
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .create-button:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.35),
      rgba(118, 75, 162, 0.25)
    );
    transform: scale(1.05);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.25);
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
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    font-size: 14px;
    background: rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(8px);
    color: rgba(255, 255, 255, 0.95);
    transition: all 0.2s ease;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(102, 126, 234, 0.5);
    background: rgba(0, 0, 0, 0.15);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
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
    color: rgba(255, 255, 255, 0.6);
    padding: 4px;
  }

  .clear-search:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .thread-list-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .create-thread-form {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(8px);
  }

  .create-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 8px;
    background: rgba(0, 0, 0, 0.1);
    color: rgba(255, 255, 255, 0.95);
  }

  .create-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .create-input:focus {
    outline: none;
    border-color: rgba(102, 126, 234, 0.5);
    background: rgba(0, 0, 0, 0.15);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
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
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.25),
      rgba(118, 75, 162, 0.15)
    );
    backdrop-filter: blur(12px) saturate(150%);
    color: white;
    border-color: rgba(102, 126, 234, 0.3);
  }

  .create-save:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.35),
      rgba(118, 75, 162, 0.25)
    );
    border-color: rgba(102, 126, 234, 0.4);
  }

  .create-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .create-cancel {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .create-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .threads {
    padding: 0 8px;
  }

  .thread-item {
    padding: 12px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 4px;
    border: 1px solid transparent;
    backdrop-filter: blur(8px);
  }

  .thread-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .thread-item.active {
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.15),
      rgba(118, 75, 162, 0.08)
    );
    border-color: rgba(102, 126, 234, 0.3);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
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
    color: rgba(255, 255, 255, 0.95);
    margin: 0;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
  }

  .thread-time {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
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
    color: rgba(255, 255, 255, 0.7);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
  }

  .message-count {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
  }

  .thread-badges {
    margin-top: 4px;
  }

  .public-badge {
    background: rgba(59, 130, 246, 0.2);
    color: rgba(147, 197, 253, 0.9);
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    backdrop-filter: blur(4px);
  }

  .empty-state, .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
  }

  .empty-icon, .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.7;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  }

  .empty-state p, .loading-state p, .error-state p {
    margin: 0 0 8px 0;
    font-size: 14px;
  }

  .empty-subtitle {
    font-size: 13px !important;
    color: rgba(255, 255, 255, 0.5) !important;
  }

  .start-conversation, .retry-button, .clear-search-button {
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.25),
      rgba(118, 75, 162, 0.15)
    );
    backdrop-filter: blur(12px) saturate(150%);
    color: white;
    border: 1px solid rgba(102, 126, 234, 0.3);
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    margin-top: 12px;
    transition: all 0.2s ease;
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .start-conversation:hover, .retry-button:hover, .clear-search-button:hover {
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.35),
      rgba(118, 75, 162, 0.25)
    );
    transform: translateY(-1px);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.25);
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top: 2px solid rgba(102, 126, 234, 0.8);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
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