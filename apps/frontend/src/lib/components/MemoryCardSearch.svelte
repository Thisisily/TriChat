<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { trpc } from '../trpc.js';
  import MemoryCard from './MemoryCard.svelte';
  import LoadingSpinner from './LoadingSpinner.svelte';
  
  export let query = '';
  export let autoSearch = true;
  export let showAdvanced = false;
  export let maxResults = 10;
  
  const dispatch = createEventDispatcher();
  
  // Search state
  let searchResults: any[] = [];
  let isSearching = false;
  let error: string | null = null;
  let hasSearched = false;
  
  // Advanced search options
  let threshold = 0.75;
  let metric: 'cosine' | 'dotProduct' | 'l2' = 'cosine';
  let excludeIds: string[] = [];
  
  // Search timeout for debouncing
  let searchTimeout: NodeJS.Timeout;
  
  // Perform similarity search
  async function performSearch() {
    if (!query.trim()) {
      searchResults = [];
      hasSearched = false;
      return;
    }
    
    if (isSearching) return;
    
    try {
      isSearching = true;
      error = null;
      
      const result = await trpc.memoryCards.searchSimilar.query({
        query: query.trim(),
        limit: maxResults,
        threshold,
        metric,
        excludeIds: excludeIds.length > 0 ? excludeIds : undefined,
      });
      
      searchResults = result.results.map(result => ({
        ...result,
        similarity: result.similarity,
        relevance: getRelevanceFromSimilarity(result.similarity),
      }));
      
      hasSearched = true;
      
      // Dispatch search results
      dispatch('results', {
        query,
        results: searchResults,
        count: result.count,
        metric: result.metric,
        threshold: result.threshold,
      });
      
    } catch (err) {
      console.error('Error performing similarity search:', err);
      error = err instanceof Error ? err.message : 'Search failed';
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }
  
  // Get relevance level from similarity score
  function getRelevanceFromSimilarity(similarity: number): 'high' | 'medium' | 'low' {
    if (similarity >= 0.9) return 'high';
    if (similarity >= 0.8) return 'medium';
    return 'low';
  }
  
  // Handle search input with debouncing
  function handleSearchInput() {
    if (!autoSearch) return;
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch();
    }, 300);
  }
  
  // Manual search trigger
  function handleSearch() {
    performSearch();
  }
  
  // Clear search
  function clearSearch() {
    query = '';
    searchResults = [];
    hasSearched = false;
    error = null;
  }
  
  // Handle memory card actions
  function handleView(event: CustomEvent) {
    dispatch('view', event.detail);
  }
  
  function handleEdit(event: CustomEvent) {
    dispatch('edit', event.detail);
  }
  
  function handleDelete(event: CustomEvent) {
    dispatch('delete', event.detail);
  }
  
  // Reactive statements
  $: if (autoSearch && query !== undefined) {
    handleSearchInput();
  }
  
  // Get metric description
  function getMetricDescription(metric: string): string {
    switch (metric) {
      case 'cosine':
        return 'Best for semantic similarity - finds contextually related memories';
      case 'dotProduct':
        return 'Good for normalized vectors - finds similar magnitude memories';
      case 'l2':
        return 'Euclidean distance - finds memories with similar exact features';
      default:
        return '';
    }
  }
  
  // Format similarity percentage
  function formatSimilarity(similarity: number): string {
    return `${(similarity * 100).toFixed(1)}%`;
  }
</script>

<div class="memory-search">
  <!-- Search Header -->
  <div class="search-header">
    <h3 class="search-title">🔍 Search Memories</h3>
    <p class="search-subtitle">Find similar memories using AI vector search</p>
  </div>
  
  <!-- Search Input -->
  <div class="search-input-section">
    <div class="search-input-wrapper">
      <div class="search-field">
        <textarea
          class="search-textarea"
          placeholder="Describe what you're looking for... (e.g., 'JavaScript debugging tips' or 'React component patterns')"
          bind:value={query}
          rows="3"
          disabled={isSearching}
        ></textarea>
        
        <div class="search-actions">
          {#if !autoSearch}
            <button
              class="search-btn"
              on:click={handleSearch}
              disabled={isSearching || !query.trim()}
            >
              {#if isSearching}
                <LoadingSpinner size="sm" />
                Searching...
              {:else}
                🔍 Search
              {/if}
            </button>
          {/if}
          
          {#if query}
            <button
              class="clear-btn"
              on:click={clearSearch}
              title="Clear search"
            >
              ✕ Clear
            </button>
          {/if}
          
          <button
            class="advanced-toggle"
            on:click={() => showAdvanced = !showAdvanced}
            title="Advanced options"
          >
            ⚙️ {showAdvanced ? 'Hide' : 'Advanced'}
          </button>
        </div>
      </div>
      
      {#if isSearching}
        <div class="search-loading">
          <LoadingSpinner size="sm" />
          <span>Searching through your memories...</span>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Advanced Options -->
  {#if showAdvanced}
    <div class="advanced-options">
      <div class="options-grid">
        <!-- Similarity Threshold -->
        <div class="option-group">
          <label class="option-label">
            Similarity Threshold: {(threshold * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            class="range-input"
            min="0.5"
            max="1.0"
            step="0.05"
            bind:value={threshold}
          />
          <div class="range-labels">
            <span>50% (Loose)</span>
            <span>100% (Exact)</span>
          </div>
        </div>
        
        <!-- Distance Metric -->
        <div class="option-group">
          <label class="option-label">Search Method</label>
          <select class="select-input" bind:value={metric}>
            <option value="cosine">Cosine Similarity (Recommended)</option>
            <option value="dotProduct">Dot Product</option>
            <option value="l2">Euclidean Distance</option>
          </select>
          <div class="option-description">
            {getMetricDescription(metric)}
          </div>
        </div>
        
        <!-- Max Results -->
        <div class="option-group">
          <label class="option-label">Max Results</label>
          <select class="select-input" bind:value={maxResults}>
            <option value={5}>5 results</option>
            <option value={10}>10 results</option>
            <option value={20}>20 results</option>
            <option value={50}>50 results</option>
          </select>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Search Results -->
  <div class="search-results">
    <!-- Error State -->
    {#if error}
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-message">{error}</div>
        <button class="retry-btn" on:click={handleSearch}>
          Try Again
        </button>
      </div>
    {/if}
    
    <!-- Empty State -->
    {#if hasSearched && !isSearching && !error && searchResults.length === 0}
      <div class="empty-state">
        <div class="empty-icon">🤔</div>
        <div class="empty-title">No Similar Memories Found</div>
        <div class="empty-message">
          Try adjusting your search or lowering the similarity threshold
        </div>
      </div>
    {/if}
    
    <!-- Results Header -->
    {#if searchResults.length > 0}
      <div class="results-header">
        <div class="results-info">
          <span class="results-count">
            {searchResults.length} similar memories found
          </span>
          <span class="results-query">for "{query}"</span>
        </div>
        <div class="results-meta">
          <span class="metric-info">
            Using {metric} similarity • {(threshold * 100).toFixed(0)}%+ threshold
          </span>
        </div>
      </div>
    {/if}
    
    <!-- Results Grid -->
    {#if searchResults.length > 0}
      <div class="results-grid">
        {#each searchResults as result (result.id)}
          <MemoryCard
            memoryCard={result}
            similarity={result.similarity}
            relevance={result.relevance}
            compact={true}
            on:view={handleView}
            on:edit={handleEdit}
            on:delete={handleDelete}
          />
        {/each}
      </div>
    {/if}
    
    <!-- No Search State -->
    {#if !hasSearched && !isSearching && !query.trim()}
      <div class="no-search-state">
        <div class="no-search-icon">🧠</div>
        <div class="no-search-title">Semantic Memory Search</div>
        <div class="no-search-message">
          Describe what you're looking for and I'll find similar memories from your knowledge base using AI vector search.
        </div>
        <div class="search-examples">
          <div class="examples-title">Try searching for:</div>
          <div class="examples-list">
            <button 
              class="example-btn"
              on:click={() => query = 'JavaScript debugging techniques'}
            >
              "JavaScript debugging techniques"
            </button>
            <button 
              class="example-btn"
              on:click={() => query = 'React component patterns'}
            >
              "React component patterns"
            </button>
            <button 
              class="example-btn"
              on:click={() => query = 'database optimization tips'}
            >
              "Database optimization tips"
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .memory-search {
    @apply space-y-6;
  }
  
  /* Header */
  .search-header {
    @apply text-center mb-6;
  }
  
  .search-title {
    @apply text-xl font-bold text-white mb-1;
  }
  
  .search-subtitle {
    @apply text-slate-400 text-sm;
  }
  
  /* Search Input */
  .search-input-section {
    @apply space-y-3;
  }
  
  .search-input-wrapper {
    @apply space-y-3;
  }
  
  .search-field {
    @apply space-y-3;
  }
  
  .search-textarea {
    @apply w-full p-4 rounded-lg border border-white/10 backdrop-blur-sm
           bg-white/5 text-white placeholder-slate-400 resize-none
           focus:border-purple-400/50 focus:bg-white/10 transition-all duration-200
           focus:outline-none focus:ring-2 focus:ring-purple-400/20;
  }
  
  .search-actions {
    @apply flex items-center gap-2 flex-wrap;
  }
  
  .search-btn {
    @apply px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20
           border border-purple-400/30 text-white font-medium
           hover:border-purple-400/50 hover:bg-purple-500/30
           transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
           flex items-center gap-2;
  }
  
  .clear-btn,
  .advanced-toggle {
    @apply px-4 py-2 rounded-lg border border-white/10 backdrop-blur-sm
           bg-white/5 hover:bg-white/10 transition-all duration-200
           text-sm text-white hover:border-white/20;
  }
  
  .search-loading {
    @apply flex items-center gap-2 text-slate-400 text-sm;
  }
  
  /* Advanced Options */
  .advanced-options {
    @apply p-4 rounded-lg border border-white/10 backdrop-blur-sm
           bg-white/5 space-y-4;
  }
  
  .options-grid {
    @apply grid gap-4 md:grid-cols-3;
  }
  
  .option-group {
    @apply space-y-2;
  }
  
  .option-label {
    @apply block text-sm font-medium text-white;
  }
  
  .range-input {
    @apply w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer;
  }
  
  .range-input::-webkit-slider-thumb {
    @apply appearance-none w-4 h-4 bg-purple-400 rounded-full cursor-pointer;
  }
  
  .range-labels {
    @apply flex justify-between text-xs text-slate-400;
  }
  
  .select-input {
    @apply w-full p-2 rounded-lg border border-white/10 backdrop-blur-sm
           bg-white/5 text-white focus:border-purple-400/50 focus:bg-white/10
           transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400/20;
  }
  
  .option-description {
    @apply text-xs text-slate-400;
  }
  
  /* Results */
  .search-results {
    @apply space-y-4;
  }
  
  .results-header {
    @apply space-y-2 pb-4 border-b border-white/10;
  }
  
  .results-info {
    @apply flex items-center gap-2 flex-wrap;
  }
  
  .results-count {
    @apply font-medium text-white;
  }
  
  .results-query {
    @apply text-slate-400;
  }
  
  .results-meta {
    @apply text-sm text-slate-500;
  }
  
  .results-grid {
    @apply grid gap-4;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
  
  /* States */
  .error-state,
  .empty-state,
  .no-search-state {
    @apply text-center py-8 px-6;
  }
  
  .error-icon,
  .empty-icon,
  .no-search-icon {
    @apply text-3xl mb-3;
  }
  
  .error-message,
  .empty-title,
  .no-search-title {
    @apply text-lg font-semibold text-white mb-2;
  }
  
  .empty-message,
  .no-search-message {
    @apply text-slate-400 mb-4;
  }
  
  .retry-btn {
    @apply px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20
           border border-purple-400/30 text-white font-medium
           hover:border-purple-400/50 hover:bg-purple-500/30
           transition-all duration-200;
  }
  
  /* Search Examples */
  .search-examples {
    @apply mt-6 space-y-3;
  }
  
  .examples-title {
    @apply text-sm font-medium text-slate-300 mb-2;
  }
  
  .examples-list {
    @apply flex flex-wrap gap-2 justify-center;
  }
  
  .example-btn {
    @apply px-3 py-1 rounded-full bg-white/5 border border-white/10
           text-sm text-slate-300 hover:bg-white/10 hover:border-white/20
           transition-all duration-200;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .options-grid {
      @apply grid-cols-1;
    }
    
    .results-grid {
      grid-template-columns: 1fr;
    }
    
    .search-actions {
      @apply flex-col items-stretch;
    }
    
    .search-btn,
    .clear-btn,
    .advanced-toggle {
      @apply w-full justify-center;
    }
  }
</style> 