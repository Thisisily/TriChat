<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { trpc } from '../trpc.js';
  import MemoryCard from './MemoryCard.svelte';
  import LoadingSpinner from './LoadingSpinner.svelte';
  import ToastNotification from './ToastNotification.svelte';
  import MemoryGraph from './MemoryGraph.svelte';
  
  export let compact = false;
  export let showSearch = true;
  export let showStats = true;
  export let maxItems: number | undefined = undefined;
  export let autoMemoryEnabled = false;
  
  // State management
  let memoryCards: any[] = [];
  let isLoading = false;
  let error: string | null = null;
  let searchQuery = '';
  let nextCursor: string | undefined = undefined;
  let hasMore = false;
  let stats: any = null;
  let viewMode: 'graph' | 'list' = 'graph';
  let selectedCardId: string | null = null;
  
  // UI state
  let showCreateModal = false;
  let showEditModal = false;
  let editingMemory: any = null;
  let toastMessage = '';
  let toastType: 'success' | 'error' | 'info' = 'info';
  let newMemoryTitle = '';
  let newMemoryContent = '';
  
  // Search and filter state
  let searchTimeout: NodeJS.Timeout;
  let isSearching = false;
  
  // Load memory cards
  async function loadMemoryCards(reset = false) {
    if (isLoading) return;
    
    try {
      isLoading = true;
      error = null;
      
      const cursor = reset ? undefined : nextCursor;
      const limit = maxItems || 20;
      
      const result = await trpc.memoryCards.list.query({
        limit,
        cursor,
        search: searchQuery || undefined,
      });
      
      if (reset) {
        memoryCards = result.memoryCards;
      } else {
        memoryCards = [...memoryCards, ...result.memoryCards];
      }
      
      nextCursor = result.nextCursor;
      hasMore = result.hasMore;
      
    } catch (err) {
      console.error('Error loading memory cards:', err);
      error = err instanceof Error ? err.message : 'Failed to load memory cards';
      showToast('Failed to load memory cards', 'error');
    } finally {
      isLoading = false;
    }
  }
  
  // Load statistics
  async function loadStats() {
    try {
      stats = await trpc.memoryCards.getStats.query();
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }
  
  // Search functionality
  function handleSearchInput() {
    clearTimeout(searchTimeout);
    isSearching = true;
    
    searchTimeout = setTimeout(async () => {
      try {
        await loadMemoryCards(true);
      } finally {
        isSearching = false;
      }
    }, 300);
  }
  
  // Memory card actions
  function handleView(event: CustomEvent) {
    const { memoryCard } = event.detail;
    selectedCardId = memoryCard.id;
  }
  
  function handleEdit(event: CustomEvent) {
    const { memoryCard } = event.detail;
    editingMemory = memoryCard;
    showEditModal = true;
  }
  
  async function handleDelete(event: CustomEvent) {
    const { memoryCard } = event.detail;
    
    if (!confirm(`Are you sure you want to delete "${memoryCard.title}"?`)) {
      return;
    }
    
    try {
      await trpc.memoryCards.delete.mutate({ id: memoryCard.id });
      memoryCards = memoryCards.filter(card => card.id !== memoryCard.id);
      showToast('Memory card deleted successfully', 'success');
      
      // Reload stats
      if (showStats) {
        await loadStats();
      }
    } catch (err) {
      console.error('Error deleting memory card:', err);
      showToast('Failed to delete memory card', 'error');
    }
  }
  
  // Create new memory card
  async function handleCreate() {
    showCreateModal = true;
  }
  
  async function createMemory() {
    if (!newMemoryTitle.trim() || !newMemoryContent.trim()) {
      showToast('Please fill in both title and content', 'error');
      return;
    }
    
    try {
      isLoading = true;
      const result = await trpc.memoryCards.create.mutate({
        title: newMemoryTitle,
        content: newMemoryContent,
        metadata: {},
      });
      
      // Clear form
      newMemoryTitle = '';
      newMemoryContent = '';
      showCreateModal = false;
      
      // Reload memory cards
      await loadMemoryCards(true);
      showToast('Memory card created successfully', 'success');
    } catch (err: any) {
      console.error('Error creating memory card:', err);
      showToast('Failed to create memory card', 'error');
    } finally {
      isLoading = false;
    }
  }
  
  // Toast notification
  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    toastMessage = message;
    toastType = type;
    setTimeout(() => {
      toastMessage = '';
    }, 3000);
  }
  
  // Load more functionality
  function loadMore() {
    if (hasMore && !isLoading) {
      loadMemoryCards(false);
    }
  }
  
  // Clear search
  function clearSearch() {
    searchQuery = '';
    loadMemoryCards(true);
  }
  
  // Refresh data
  async function refresh() {
    await Promise.all([
      loadMemoryCards(true),
      showStats ? loadStats() : Promise.resolve()
    ]);
  }
  
  // Initialize
  onMount(() => {
    refresh();
  });
  
  // Reactive statements
  $: if (searchQuery !== undefined) {
    handleSearchInput();
  }
</script>

<div class="memory-card-list">
  <!-- Tab Navigation -->
  <div class="memory-tabs">
    <button 
      class="memory-tab {viewMode === 'graph' ? 'active' : ''}"
      on:click={() => viewMode = 'graph'}
    >
      <span class="tab-icon">🕸️</span>
      <span class="tab-label">Neural Graph</span>
      <div class="tab-indicator"></div>
    </button>
    
    <button 
      class="memory-tab {viewMode === 'list' ? 'active' : ''}"
      on:click={() => viewMode = 'list'}
    >
      <span class="tab-icon">📚</span>
      <span class="tab-label">Card List</span>
      <div class="tab-indicator"></div>
    </button>
    
    <div class="tab-actions">
      <button
        class="action-icon-btn"
        on:click={refresh}
        disabled={isLoading}
        title="Refresh memories"
      >
        <span class="icon-refresh {isLoading ? 'spinning' : ''}">🔄</span>
      </button>
      
      <button
        class="action-btn create-btn"
        on:click={handleCreate}
        title="Create new memory"
      >
        <span class="btn-icon">✨</span>
        <span class="btn-label">New Memory</span>
      </button>
    </div>
  </div>
  
  <!-- Statistics Bar -->
  {#if showStats && stats && viewMode === 'list'}
    <div class="memory-stats-bar" transition:slide={{ duration: 200 }}>
      <div class="stat-item">
        <div class="stat-icon">🧠</div>
        <div class="stat-info">
          <div class="stat-value">{stats.totalCards}</div>
          <div class="stat-label">Total</div>
        </div>
      </div>
      
      <div class="stat-item">
        <div class="stat-icon">⚡</div>
        <div class="stat-info">
          <div class="stat-value">{stats.cardsWithEmbeddings}</div>
          <div class="stat-label">Indexed</div>
        </div>
      </div>
      
      <div class="stat-item">
        <div class="stat-icon">📊</div>
        <div class="stat-info">
          <div class="stat-value">{stats.embeddingCoverage}%</div>
          <div class="stat-label">Coverage</div>
        </div>
      </div>
      
      <div class="stat-item">
        <div class="stat-icon">🆕</div>
        <div class="stat-info">
          <div class="stat-value">{stats.recentCards}</div>
          <div class="stat-label">This Week</div>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Search Bar (List View Only) -->
  {#if showSearch && viewMode === 'list'}
    <div class="memory-search-bar" transition:slide={{ duration: 200 }}>
      <div class="search-wrapper">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          class="search-input"
          placeholder="Search neural memories..."
          bind:value={searchQuery}
          disabled={isLoading}
        />
        {#if searchQuery}
          <button
            class="search-clear"
            on:click={clearSearch}
            title="Clear search"
          >
            ✕
          </button>
        {/if}
        {#if isSearching}
          <div class="search-loading">
            <LoadingSpinner size="small" variant="glass" />
          </div>
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- Content Area -->
  <div class="memory-content-area">
    {#if error && !isLoading}
      <div class="error-state" transition:fade={{ duration: 200 }}>
        <div class="error-icon">⚠️</div>
        <div class="error-title">Connection Error</div>
        <div class="error-message">{error}</div>
        <button class="retry-btn" on:click={() => loadMemoryCards(true)}>
          Try Again
        </button>
      </div>
    {:else if isLoading && memoryCards.length === 0}
      <div class="loading-state" transition:fade={{ duration: 200 }}>
        <div class="loading-animation">
          <div class="neural-loader">
            <div class="neuron"></div>
            <div class="neuron"></div>
            <div class="neuron"></div>
            <div class="connection"></div>
            <div class="connection"></div>
          </div>
        </div>
        <div class="loading-text">Loading neural memories...</div>
      </div>
    {:else if viewMode === 'graph'}
      {#if memoryCards.length === 0}
        <div class="empty-state graph-empty" transition:fade={{ duration: 200 }}>
          <div class="empty-visual">
            <div class="empty-brain">🧠</div>
            <div class="empty-connections">
              <div class="connection-dot"></div>
              <div class="connection-dot"></div>
              <div class="connection-dot"></div>
            </div>
          </div>
          <div class="empty-title">No Neural Connections Yet</div>
          <div class="empty-message">Create your first memory to start building your knowledge graph</div>
          <button class="create-first-btn" on:click={handleCreate}>
            <span class="btn-icon">✨</span>
            Create First Memory
          </button>
        </div>
      {:else}
        <div class="graph-view" transition:fade={{ duration: 200 }}>
          <MemoryGraph 
            memoryCards={memoryCards} 
            bind:selectedCardId 
          />
          
          {#if selectedCardId}
            {@const selectedCard = memoryCards.find(card => card.id === selectedCardId)}
            {#if selectedCard}
              <div class="selected-card-preview" transition:slide={{ duration: 200 }}>
                <MemoryCard
                  memoryCard={selectedCard}
                  compact={false}
                  on:view={handleView}
                  on:edit={handleEdit}
                  on:delete={handleDelete}
                />
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    {:else}
      {#if memoryCards.length === 0}
        <div class="empty-state list-empty" transition:fade={{ duration: 200 }}>
          <div class="empty-icon">📚</div>
          <div class="empty-title">No Memory Cards Yet</div>
          <div class="empty-message">
            {#if searchQuery}
              No memories found matching "{searchQuery}"
            {:else}
              Start building your knowledge base
            {/if}
          </div>
          {#if !searchQuery}
            <button class="create-first-btn" on:click={handleCreate}>
              <span class="btn-icon">✨</span>
              Create First Memory
            </button>
          {:else}
            <button class="clear-search-btn" on:click={clearSearch}>
              Clear Search
            </button>
          {/if}
        </div>
      {:else}
        <div class="memory-grid" class:compact transition:fade={{ duration: 200 }}>
          {#each memoryCards as memoryCard (memoryCard.id)}
            <div transition:fade={{ duration: 150 }}>
              <MemoryCard
                {memoryCard}
                {compact}
                on:view={handleView}
                on:edit={handleEdit}
                on:delete={handleDelete}
              />
            </div>
          {/each}
        </div>
        
        {#if hasMore && !maxItems}
          <div class="load-more-container" transition:fade={{ duration: 200 }}>
            <button
              class="load-more-btn"
              on:click={loadMore}
              disabled={isLoading}
            >
              {#if isLoading}
                <LoadingSpinner size="small" variant="glass" />
                <span>Loading more...</span>
              {:else}
                <span>Load More Memories</span>
              {/if}
            </button>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<!-- Toast Notification -->
{#if toastMessage}
  <ToastNotification
    message={toastMessage}
    type={toastType}
    on:close={() => toastMessage = ''}
  />
{/if}

<!-- Create Memory Modal -->
{#if showCreateModal}
  <div class="modal-backdrop" on:click={() => showCreateModal = false}>
    <div class="modal-content" on:click|stopPropagation transition:fade={{ duration: 200 }}>
      <div class="modal-header">
        <h3 class="modal-title">✨ Create New Memory</h3>
        <button 
          class="modal-close-btn"
          on:click={() => showCreateModal = false}
          title="Close"
        >
          ✕
        </button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label for="memory-title" class="form-label">Title</label>
          <input
            id="memory-title"
            type="text"
            class="form-input"
            placeholder="Enter a memorable title..."
            bind:value={newMemoryTitle}
            disabled={isLoading}
          />
        </div>
        
        <div class="form-group">
          <label for="memory-content" class="form-label">Content</label>
          <textarea
            id="memory-content"
            class="form-textarea"
            placeholder="Describe what you want to remember..."
            rows="6"
            bind:value={newMemoryContent}
            disabled={isLoading}
          />
        </div>
      </div>
      
      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          on:click={() => showCreateModal = false}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          on:click={createMemory}
          disabled={isLoading || !newMemoryTitle.trim() || !newMemoryContent.trim()}
        >
          {#if isLoading}
            <LoadingSpinner size="small" variant="glass" />
            Creating...
          {:else}
            <span class="btn-icon">🧠</span>
            Create Memory
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .memory-card-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
  }
  
  /* Tab Navigation */
  .memory-tabs {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0 4px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
  }
  
  .memory-tab {
    flex: 1;
    padding: 16px 24px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    overflow: hidden;
  }
  
  .memory-tab:hover {
    color: rgba(255, 255, 255, 0.8);
  }
  
  .memory-tab.active {
    color: rgba(255, 255, 255, 0.95);
  }
  
  .tab-icon {
    font-size: 20px;
    filter: grayscale(100%);
    transition: filter 0.3s ease;
  }
  
  .memory-tab.active .tab-icon {
    filter: grayscale(0%);
  }
  
  .tab-indicator {
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 3px;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    border-radius: 3px 3px 0 0;
    transform: translateX(-50%);
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .memory-tab.active .tab-indicator {
    width: 80%;
  }
  
  .tab-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    margin-left: auto;
  }
  
  .action-icon-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .action-icon-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
  }
  
  .action-icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .icon-refresh {
    font-size: 18px;
    display: block;
    transition: transform 0.3s ease;
  }
  
  .icon-refresh.spinning {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .action-btn {
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .create-btn {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    border-color: rgba(102, 126, 234, 0.2);
  }
  
  .create-btn:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
    border-color: rgba(102, 126, 234, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
  }
  
  .btn-icon {
    font-size: 16px;
  }
  
  /* Statistics Bar */
  .memory-stats-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .stat-icon {
    font-size: 32px;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  }
  
  .stat-info {
    flex: 1;
  }
  
  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    line-height: 1;
  }
  
  .stat-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
  }
  
  /* Search Bar */
  .memory-search-bar {
    padding: 0;
  }
  
  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .search-icon {
    position: absolute;
    left: 16px;
    font-size: 20px;
    pointer-events: none;
    z-index: 1;
  }
  
  .search-input {
    width: 100%;
    padding: 16px 16px 16px 48px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 15px;
    transition: all 0.2s ease;
  }
  
  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  
  .search-input:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(102, 126, 234, 0.3);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  
  .search-clear {
    position: absolute;
    right: 48px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 18px;
    cursor: pointer;
    padding: 8px;
    transition: all 0.2s ease;
  }
  
  .search-clear:hover {
    color: rgba(255, 255, 255, 0.8);
    transform: scale(1.1);
  }
  
  .search-loading {
    position: absolute;
    right: 16px;
  }
  
  /* Content Area */
  .memory-content-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  
  /* Loading State */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 24px;
  }
  
  .neural-loader {
    position: relative;
    width: 120px;
    height: 120px;
  }
  
  .neuron {
    position: absolute;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    animation: neuron-pulse 2s ease-in-out infinite;
  }
  
  .neuron:nth-child(1) {
    top: 10px;
    left: 50px;
    animation-delay: 0s;
  }
  
  .neuron:nth-child(2) {
    top: 50px;
    left: 10px;
    animation-delay: 0.3s;
  }
  
  .neuron:nth-child(3) {
    top: 50px;
    right: 10px;
    animation-delay: 0.6s;
  }
  
  .connection {
    position: absolute;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, #667eea 50%, transparent 100%);
    transform-origin: left center;
    animation: connection-flow 2s ease-in-out infinite;
  }
  
  .connection:nth-child(4) {
    top: 20px;
    left: 60px;
    width: 40px;
    transform: rotate(135deg);
  }
  
  .connection:nth-child(5) {
    top: 60px;
    left: 20px;
    width: 40px;
    transform: rotate(45deg);
  }
  
  @keyframes neuron-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 0.6;
    }
    50% {
      transform: scale(1.2);
      opacity: 1;
    }
  }
  
  @keyframes connection-flow {
    0%, 100% {
      opacity: 0.2;
    }
    50% {
      opacity: 0.8;
    }
  }
  
  .loading-text {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.6);
  }
  
  /* Empty States */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
    padding: 40px;
  }
  
  .empty-visual {
    position: relative;
    margin-bottom: 32px;
  }
  
  .empty-brain {
    font-size: 80px;
    filter: grayscale(50%);
    opacity: 0.5;
    animation: float 6s ease-in-out infinite;
  }
  
  .empty-connections {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200px;
    height: 200px;
  }
  
  .connection-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    background: rgba(102, 126, 234, 0.3);
    border-radius: 50%;
    animation: orbit 10s linear infinite;
  }
  
  .connection-dot:nth-child(1) {
    animation-delay: 0s;
  }
  
  .connection-dot:nth-child(2) {
    animation-delay: 3.33s;
  }
  
  .connection-dot:nth-child(3) {
    animation-delay: 6.66s;
  }
  
  @keyframes orbit {
    from {
      transform: rotate(0deg) translateX(80px) rotate(0deg);
    }
    to {
      transform: rotate(360deg) translateX(80px) rotate(-360deg);
    }
  }
  
  .empty-icon {
    font-size: 64px;
    margin-bottom: 24px;
    opacity: 0.5;
  }
  
  .empty-title {
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 8px;
  }
  
  .empty-message {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 24px;
  }
  
  .create-first-btn,
  .clear-search-btn,
  .retry-btn {
    padding: 12px 24px;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
    border: 1px solid rgba(102, 126, 234, 0.3);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .create-first-btn:hover,
  .clear-search-btn:hover,
  .retry-btn:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
    border-color: rgba(102, 126, 234, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(102, 126, 234, 0.3);
  }
  
  /* Error State */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
    padding: 40px;
  }
  
  .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  .error-title {
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 8px;
  }
  
  .error-message {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 24px;
  }
  
  /* Graph View */
  .graph-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .selected-card-preview {
    background: rgba(255, 255, 255, 0.02);
    border-radius: 16px;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  /* Memory Grid */
  .memory-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    padding: 4px;
  }
  
  .memory-grid.compact {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  
  /* Load More */
  .load-more-container {
    display: flex;
    justify-content: center;
    padding: 32px;
  }
  
  .load-more-btn {
    padding: 12px 32px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .load-more-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
  
  .load-more-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Mobile Responsive */
  @media (max-width: 768px) {
    .memory-tabs {
      flex-wrap: wrap;
    }
    
    .tab-actions {
      width: 100%;
      justify-content: center;
      padding: 8px;
    }
    
    .memory-stats-bar {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .memory-grid {
      grid-template-columns: 1fr;
    }
  }
  
  /* Modal Styles */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .modal-content {
    width: 100%;
    max-width: 500px;
    background: linear-gradient(
      135deg,
      rgba(15, 15, 25, 0.98) 0%,
      rgba(25, 25, 40, 0.98) 100%
    );
    backdrop-filter: blur(20px) saturate(180%);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 10px 40px rgba(0, 0, 0, 0.4),
      0 2px 10px rgba(102, 126, 234, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }
  
  .modal-header {
    padding: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .modal-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .modal-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.6);
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .modal-close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    transform: scale(1.05);
  }
  
  .modal-body {
    padding: 24px;
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .form-group:last-child {
    margin-bottom: 0;
  }
  
  .form-label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .form-input,
  .form-textarea {
    width: 100%;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 15px;
    transition: all 0.2s ease;
  }
  
  .form-input::placeholder,
  .form-textarea::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  
  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(102, 126, 234, 0.3);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  
  .form-input:disabled,
  .form-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .form-textarea {
    resize: vertical;
    min-height: 120px;
    font-family: inherit;
  }
  
  .modal-footer {
    padding: 20px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }
  
  .btn {
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid transparent;
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }
  
  .btn-primary {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
    border-color: rgba(102, 126, 234, 0.3);
    color: rgba(255, 255, 255, 0.9);
  }
  
  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
    border-color: rgba(102, 126, 234, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
  }
  
  .btn-icon {
    font-size: 16px;
  }
</style> 