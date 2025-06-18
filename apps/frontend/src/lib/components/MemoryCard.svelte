<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let memoryCard: {
    id: string;
    title: string;
    content: string;
    summary?: string;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
  };
  
  export let similarity: number | undefined = undefined;
  export let relevance: 'high' | 'medium' | 'low' | undefined = undefined;
  export let showActions = true;
  export let compact = false;
  
  const dispatch = createEventDispatcher();
  
  function handleView() {
    dispatch('view', { memoryCard });
  }
  
  function handleEdit() {
    dispatch('edit', { memoryCard });
  }
  
  function handleDelete() {
    dispatch('delete', { memoryCard });
  }
  
  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  }
  
  function getRelevanceColor(relevance: string): string {
    switch (relevance) {
      case 'high': return 'text-emerald-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-slate-400';
      default: return 'text-slate-400';
    }
  }
  
  function getRelevanceIcon(relevance: string): string {
    switch (relevance) {
      case 'high': return '🔥';
      case 'medium': return '⚡';
      case 'low': return '💫';
      default: return '🧠';
    }
  }
  
  $: displayContent = memoryCard.summary || memoryCard.content;
  $: truncatedContent = displayContent.length > 150 
    ? displayContent.substring(0, 150) + '...' 
    : displayContent;
</script>

<div 
  class="memory-card group"
  class:compact
  on:click={handleView}
  on:keydown={(e) => e.key === 'Enter' && handleView()}
  role="button"
  tabindex="0"
>
  <!-- Memory Card Header -->
  <div class="memory-card-header">
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <h3 class="memory-title">
          {memoryCard.title}
        </h3>
        <div class="memory-meta">
          <span class="memory-date">
            {formatDate(memoryCard.createdAt)}
          </span>
          
          {#if relevance}
            <span class="memory-relevance {getRelevanceColor(relevance)}">
              {getRelevanceIcon(relevance)} {relevance}
            </span>
          {/if}
          
          {#if similarity !== undefined}
            <span class="memory-similarity">
              {(similarity * 100).toFixed(1)}% match
            </span>
          {/if}
          
          {#if memoryCard.metadata?.source}
            <span class="memory-source">
              from {memoryCard.metadata.source}
            </span>
          {/if}
        </div>
      </div>
      
      {#if showActions}
        <div class="memory-actions">
          <button
            class="action-btn edit-btn"
            on:click|stopPropagation={handleEdit}
            title="Edit memory"
          >
            ✏️
          </button>
          <button
            class="action-btn delete-btn"
            on:click|stopPropagation={handleDelete}
            title="Delete memory"
          >
            🗑️
          </button>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Memory Card Content -->
  <div class="memory-content">
    <p class="memory-text">
      {compact ? truncatedContent : displayContent}
    </p>
    
    {#if !compact && memoryCard.content !== displayContent}
      <details class="memory-details">
        <summary class="memory-details-toggle">View full content</summary>
        <div class="memory-full-content">
          <p>{memoryCard.content}</p>
        </div>
      </details>
    {/if}
  </div>
  
  <!-- Memory Card Footer -->
  {#if !compact}
    <div class="memory-footer">
      <div class="memory-stats">
        <span class="stat">
          {memoryCard.content.length} chars
        </span>
        {#if memoryCard.metadata?.keyPointsCount}
          <span class="stat">
            {memoryCard.metadata.keyPointsCount} key points
          </span>
        {/if}
        {#if memoryCard.metadata?.confidence}
          <span class="stat">
            {(memoryCard.metadata.confidence * 100).toFixed(0)}% confidence
          </span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .memory-card {
    @apply relative p-4 rounded-xl border border-white/10 backdrop-blur-xl
           bg-gradient-to-br from-white/5 to-white/[0.02] cursor-pointer
           transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]
           hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-0.5;
  }
  
  .memory-card.compact {
    @apply p-3;
  }
  
  .memory-card:focus {
    @apply outline-none ring-2 ring-purple-400/50 ring-offset-2 ring-offset-transparent;
  }
  
  .memory-card-header {
    @apply mb-3;
  }
  
  .memory-title {
    @apply font-semibold text-white text-lg leading-tight mb-2
           group-hover:text-purple-200 transition-colors duration-200;
  }
  
  .memory-card.compact .memory-title {
    @apply text-base mb-1;
  }
  
  .memory-meta {
    @apply flex flex-wrap items-center gap-2 text-sm text-slate-400;
  }
  
  .memory-date {
    @apply text-slate-500;
  }
  
  .memory-relevance {
    @apply font-medium;
  }
  
  .memory-similarity {
    @apply px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium;
  }
  
  .memory-source {
    @apply px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 text-xs;
  }
  
  .memory-actions {
    @apply flex items-center gap-1 opacity-0 group-hover:opacity-100 
           transition-opacity duration-200;
  }
  
  .action-btn {
    @apply w-8 h-8 rounded-lg border border-white/10 backdrop-blur-sm
           bg-white/5 hover:bg-white/10 transition-all duration-200
           flex items-center justify-center text-sm;
  }
  
  .edit-btn:hover {
    @apply border-blue-400/50 bg-blue-500/20;
  }
  
  .delete-btn:hover {
    @apply border-red-400/50 bg-red-500/20;
  }
  
  .memory-content {
    @apply mb-3;
  }
  
  .memory-text {
    @apply text-slate-200 leading-relaxed;
  }
  
  .memory-card.compact .memory-text {
    @apply text-sm;
  }
  
  .memory-details {
    @apply mt-3;
  }
  
  .memory-details-toggle {
    @apply text-sm text-purple-300 cursor-pointer hover:text-purple-200
           transition-colors duration-200;
  }
  
  .memory-full-content {
    @apply mt-2 p-3 rounded-lg bg-white/5 border border-white/5;
  }
  
  .memory-full-content p {
    @apply text-sm text-slate-300 leading-relaxed;
  }
  
  .memory-footer {
    @apply pt-3 border-t border-white/5;
  }
  
  .memory-stats {
    @apply flex items-center gap-3 text-xs text-slate-500;
  }
  
  .stat {
    @apply flex items-center gap-1;
  }
  
  /* Hover animations */
  .memory-card::before {
    @apply absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300
           bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10;
    content: '';
  }
  
  .memory-card:hover::before {
    @apply opacity-100;
  }
  
  /* Responsive adjustments */
  @media (max-width: 640px) {
    .memory-card {
      @apply p-3;
    }
    
    .memory-title {
      @apply text-base;
    }
    
    .memory-meta {
      @apply gap-1.5;
    }
  }
</style> 