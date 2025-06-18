<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createStreamingMessage, type StreamingMessageConfig } from '../streaming-message';
  import { createMarkdownParser, markdownUtils } from '../markdown-parser';
  import LoadingSpinner from './LoadingSpinner.svelte';

  // Props
  export let messageId: string | undefined = undefined;
  export let threadId: string | undefined = undefined;
  export let autoStart: boolean = false;
  export let showTokens: boolean = false; // Debug mode to show individual tokens
  export let enableMarkdown: boolean = true;
  export let className: string = '';
  export let onComplete: ((content: string) => void) | undefined = undefined;
  export let onError: ((error: string) => void) | undefined = undefined;
  export let onToken: ((token: string) => void) | undefined = undefined;

  // Configuration for the streaming message manager
  const config: StreamingMessageConfig = {
    messageId,
    threadId,
    autoStart,
    onComplete,
    onError,
    onToken,
  };

  // Create the streaming message manager
  const streamingMessage = createStreamingMessage(config);

  // Extract reactive stores
  const { content, isStreaming, isComplete, isError, tokens, state } = streamingMessage;

  // Create markdown parser for incremental parsing
  const markdownParser = createMarkdownParser();
  const { html: parsedHtml, isComplete: markdownComplete } = markdownParser;

  // Loading dots animation for streaming indicator
  let loadingDots = '';
  let loadingInterval: NodeJS.Timeout | null = null;

  const startLoadingAnimation = () => {
    if (loadingInterval) return;
    
    let dotCount = 0;
    loadingInterval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      loadingDots = '.'.repeat(dotCount);
    }, 500);
  };

  const stopLoadingAnimation = () => {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      loadingInterval = null;
      loadingDots = '';
    }
  };

  // Reactive statements for animations
  $: if ($isStreaming) {
    startLoadingAnimation();
  } else {
    stopLoadingAnimation();
  }

  // Public methods that can be called from parent components
  export const startStreaming = (newMessageId?: string, newThreadId?: string) => {
    streamingMessage.startStreaming(newMessageId, newThreadId);
  };

  export const stopStreaming = () => {
    streamingMessage.stopStreaming();
  };

  export const reset = () => {
    streamingMessage.reset();
  };

  export const getCurrentState = () => {
    return streamingMessage.getCurrentState();
  };

  // Cleanup on component destroy
  onDestroy(() => {
    streamingMessage.destroy();
    stopLoadingAnimation();
    markdownParser.reset(); // Clean up markdown parser
  });

  // Update markdown parser when content changes
  $: if ($content) {
    if (enableMarkdown && markdownUtils.hasMarkdown($content)) {
      if ($isStreaming) {
        // For streaming content, append incrementally
        markdownParser.appendContent($content);
      } else {
        // For complete content, set final content
        markdownParser.setContent($content, $isComplete);
      }
    } else if (enableMarkdown) {
      // Simple text without markdown - still process for consistency
      markdownParser.setContent($content, $isComplete);
    }
  }

  // Reset markdown parser when streaming starts
  $: if ($isStreaming && !$content) {
    markdownParser.reset();
  }

  // Content display logic
  let displayedContent = '';
  let animationFrameId: number | null = null;

  const animateContent = (targetContent: string) => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }

    const animate = () => {
      if (displayedContent.length < targetContent.length) {
        displayedContent = targetContent.slice(0, displayedContent.length + 1);
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animate();
  };

  // Fallback formatting for non-markdown content
  const formatPlainContent = (text: string): string => {
    return text.replace(/\n/g, '<br>');
  };

  // Update displayed content based on markdown state
  $: if (enableMarkdown) {
    // Use markdown parser output when available
    displayedContent = $parsedHtml || '';
  } else if ($content) {
    // For non-markdown, update immediately during streaming
    if ($isStreaming) {
      displayedContent = $content;
    } else if ($isComplete) {
      // Animate completed non-markdown content
      if (displayedContent !== $content) {
        animateContent($content);
      }
    }
  }

  onDestroy(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });
</script>

<div class="streaming-message {className}" class:streaming={$isStreaming} class:error={$isError} class:complete={$isComplete}>
  <!-- Main content area -->
  <div class="content-wrapper">
    {#if $isError}
      <!-- Error state -->
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <div class="error-text">
          <p>Failed to stream message</p>
          {#if $state.error}
            <small>{$state.error}</small>
          {/if}
        </div>
        <button 
          class="retry-button" 
          on:click={() => streamingMessage.startStreaming()}
          aria-label="Retry streaming"
        >
          Retry
        </button>
      </div>
    {:else if $content || $isStreaming}
      <!-- Content display -->
      <div class="message-content" class:streaming={$isStreaming}>
        {#if enableMarkdown}
          {@html displayedContent}
        {:else}
          {@html formatPlainContent(displayedContent)}
        {/if}
        
        <!-- Streaming indicator -->
        {#if $isStreaming}
          <span class="streaming-cursor" aria-label="Streaming in progress">
            <span class="cursor-blink">|</span>
            <span class="loading-dots" aria-hidden="true">{loadingDots}</span>
          </span>
        {/if}
      </div>

      <!-- Debug token display -->
      {#if showTokens && $tokens.length > 0}
        <div class="debug-tokens">
          <details>
            <summary>Tokens ({$tokens.length})</summary>
            <div class="token-list">
              {#each $tokens as token, i}
                <span class="token" title="Token {i + 1}">{token}</span>
              {/each}
            </div>
          </details>
        </div>
      {/if}

      <!-- Metadata display -->
      {#if $isComplete && $state.metadata}
        <div class="message-metadata">
          {#if $state.metadata.model}
            <span class="metadata-item">
              <span class="metadata-label">Model:</span>
              <span class="metadata-value">{$state.metadata.model}</span>
            </span>
          {/if}
          {#if $state.metadata.tokenUsage}
            <span class="metadata-item">
              <span class="metadata-label">Tokens:</span>
              <span class="metadata-value">{$state.metadata.tokenUsage.totalTokens}</span>
            </span>
          {/if}
        </div>
      {/if}
    {:else}
      <!-- Empty state -->
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <p>Waiting for message...</p>
        {#if !autoStart}
          <button 
            class="start-button" 
            on:click={() => streamingMessage.startStreaming()}
            aria-label="Start streaming"
          >
            Start Streaming
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Loading spinner for initial connection -->
  {#if $isStreaming && !$content}
    <div class="connection-loading">
      <LoadingSpinner size="small" />
      <span>Connecting...</span>
    </div>
  {/if}
</div>

<style>
  .streaming-message {
    position: relative;
    border-radius: 12px;
    transition: all 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
  }

  .streaming-message.streaming {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05));
    border: 1px solid rgba(99, 102, 241, 0.2);
  }

  .streaming-message.complete {
    background: rgba(34, 197, 94, 0.05);
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .streaming-message.error {
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .content-wrapper {
    padding: 16px;
    position: relative;
  }

  /* Message content styling */
  .message-content {
    word-wrap: break-word;
    white-space: pre-wrap;
    font-size: 15px;
    color: #1f2937;
    position: relative;
  }

  .message-content.streaming {
    animation: subtle-pulse 2s ease-in-out infinite;
  }

  .message-content :global(strong) {
    font-weight: 600;
    color: #374151;
  }

  .message-content :global(em) {
    font-style: italic;
    color: #6b7280;
  }

  .message-content :global(code) {
    background: rgba(99, 102, 241, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 13px;
  }

  /* Enhanced markdown styling */
  .message-content :global(pre) {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    margin: 12px 0;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  .message-content :global(pre code) {
    background: none;
    padding: 0;
    border-radius: 0;
  }

  .message-content :global(blockquote) {
    border-left: 4px solid #6366f1;
    margin: 12px 0;
    padding: 8px 16px;
    background: rgba(99, 102, 241, 0.05);
    font-style: italic;
  }

  .message-content :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 14px;
  }

  .message-content :global(th),
  .message-content :global(td) {
    border: 1px solid #e5e7eb;
    padding: 8px 12px;
    text-align: left;
  }

  .message-content :global(th) {
    background: #f9fafb;
    font-weight: 600;
  }

  .message-content :global(ul),
  .message-content :global(ol) {
    margin: 8px 0;
    padding-left: 24px;
  }

  .message-content :global(li) {
    margin: 4px 0;
  }

  .message-content :global(h1),
  .message-content :global(h2),
  .message-content :global(h3),
  .message-content :global(h4),
  .message-content :global(h5),
  .message-content :global(h6) {
    margin: 16px 0 8px 0;
    font-weight: 600;
    line-height: 1.3;
  }

  .message-content :global(h1) { font-size: 24px; }
  .message-content :global(h2) { font-size: 20px; }
  .message-content :global(h3) { font-size: 18px; }
  .message-content :global(h4) { font-size: 16px; }
  .message-content :global(h5) { font-size: 15px; }
  .message-content :global(h6) { font-size: 14px; }

  .message-content :global(a) {
    color: #6366f1;
    text-decoration: none;
  }

  .message-content :global(a:hover) {
    text-decoration: underline;
  }

  /* Streaming cursor */
  .streaming-cursor {
    display: inline-flex;
    align-items: center;
    margin-left: 2px;
  }

  .cursor-blink {
    animation: blink 1s infinite;
    color: #6366f1;
    font-weight: bold;
  }

  .loading-dots {
    margin-left: 4px;
    color: #9ca3af;
    font-size: 12px;
    min-width: 20px;
  }

  /* Error state */
  .error-content {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: rgba(254, 242, 242, 0.8);
    border-radius: 8px;
  }

  .error-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .error-text {
    flex: 1;
  }

  .error-text p {
    margin: 0 0 4px 0;
    font-weight: 500;
    color: #dc2626;
  }

  .error-text small {
    color: #7f1d1d;
    font-size: 13px;
  }

  .retry-button {
    background: #dc2626;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .retry-button:hover {
    background: #b91c1c;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #6b7280;
  }

  .empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .empty-state p {
    margin: 0 0 16px 0;
    font-size: 15px;
  }

  .start-button {
    background: #6366f1;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .start-button:hover {
    background: #5b21b6;
  }

  /* Debug tokens */
  .debug-tokens {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
  }

  .debug-tokens summary {
    cursor: pointer;
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 8px;
  }

  .token-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 120px;
    overflow-y: auto;
  }

  .token {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
    border: 1px solid #e5e7eb;
    white-space: pre;
  }

  /* Metadata */
  .message-metadata {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: #6b7280;
  }

  .metadata-item {
    display: flex;
    gap: 4px;
  }

  .metadata-label {
    font-weight: 500;
  }

  .metadata-value {
    color: #374151;
  }

  /* Connection loading */
  .connection-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    justify-content: center;
    color: #6b7280;
    font-size: 14px;
  }

  /* Animations */
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  @keyframes subtle-pulse {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1px); }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .message-content {
      color: #f9fafb;
    }

    .message-content :global(strong) {
      color: #e5e7eb;
    }

    .message-content :global(em) {
      color: #9ca3af;
    }

    .message-content :global(code) {
      background: rgba(99, 102, 241, 0.2);
      color: #e5e7eb;
    }

    .message-content :global(pre) {
      background: #1f2937;
      border-color: #374151;
      color: #e5e7eb;
    }

    .message-content :global(blockquote) {
      border-left-color: #818cf8;
      background: rgba(99, 102, 241, 0.1);
      color: #d1d5db;
    }

    .message-content :global(table) {
      color: #e5e7eb;
    }

    .message-content :global(th),
    .message-content :global(td) {
      border-color: #4b5563;
    }

    .message-content :global(th) {
      background: #374151;
      color: #f3f4f6;
    }

    .message-content :global(h1),
    .message-content :global(h2),
    .message-content :global(h3),
    .message-content :global(h4),
    .message-content :global(h5),
    .message-content :global(h6) {
      color: #f9fafb;
    }

    .message-content :global(a) {
      color: #818cf8;
    }

    .empty-state {
      color: #9ca3af;
    }

    .token {
      background: #374151;
      border-color: #4b5563;
      color: #e5e7eb;
    }

    .metadata-value {
      color: #d1d5db;
    }
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .content-wrapper {
      padding: 12px;
    }

    .message-content {
      font-size: 14px;
    }

    .message-metadata {
      flex-direction: column;
      gap: 8px;
    }
  }
</style> 