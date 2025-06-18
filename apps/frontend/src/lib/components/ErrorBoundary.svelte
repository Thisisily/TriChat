<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import LiquidGlassButton from './LiquidGlassButton.svelte';
  
  const dispatch = createEventDispatcher<{
    retry: void;
    reportError: { error: Error; errorInfo?: any };
  }>();
  
  export let fallback: string | null = null;
  export let showRetry = true;
  export let retryText = 'Try Again';
  export let className = '';
  
  let hasError = false;
  let error: Error | null = null;
  let errorInfo: any = null;
  let retryKey = 0;
  
  // Error catching mechanism using window.onerror
  function handleError(event: ErrorEvent) {
    if (event.error) {
      setError(event.error, { componentStack: event.filename + ':' + event.lineno });
    }
  }
  
  function handleUnhandledRejection(event: PromiseRejectionEvent) {
    const error = new Error(event.reason?.message || 'Unhandled promise rejection');
    setError(error, { reason: event.reason });
  }
  
  function setError(err: Error, info?: any) {
    hasError = true;
    error = err;
    errorInfo = info;
    dispatch('reportError', { error: err, errorInfo: info });
  }
  
  function handleRetry() {
    hasError = false;
    error = null;
    errorInfo = null;
    retryKey += 1; // Force re-render of child components
    dispatch('retry');
  }
  
  onMount(() => {
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  });
  
  // Public method to manually trigger error state
  export function triggerError(err: Error, info?: any) {
    setError(err, info);
  }
  
  // Public method to reset error state
  export function resetError() {
    handleRetry();
  }
</script>

<div class="error-boundary {className}">
  {#if hasError}
    <div class="error-fallback liquid-glass-card liquid-glass-depth">
      <div class="liquid-glass-layer"></div>
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h3 class="error-title">Something went wrong</h3>
        
        {#if fallback}
          <p class="error-message">{fallback}</p>
        {:else}
          <p class="error-message">
            We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
          </p>
        {/if}
        
        {#if error}
          <details class="error-details">
            <summary>Technical Details</summary>
            <div class="error-stack">
              <strong>Error:</strong> {error.message}
              {#if error.stack}
                <pre class="error-stack-trace selectable-text">{error.stack}</pre>
              {/if}
              {#if errorInfo}
                <div class="error-info">
                  <strong>Additional Info:</strong>
                  <pre class="selectable-text">{JSON.stringify(errorInfo, null, 2)}</pre>
                </div>
              {/if}
            </div>
          </details>
        {/if}
        
        <div class="error-actions">
          {#if showRetry}
            <LiquidGlassButton
              variant="primary"
              onClick={handleRetry}
            >
              {retryText}
            </LiquidGlassButton>
          {/if}
          
          <LiquidGlassButton
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </LiquidGlassButton>
        </div>
      </div>
    </div>
  {:else}
    <!-- Re-render children when retryKey changes -->
    {#key retryKey}
      <slot></slot>
    {/key}
  {/if}
</div>

<style>
  .error-boundary {
    display: contents;
  }
  
  .error-fallback {
    padding: 32px;
    margin: 16px;
    border-radius: 16px;
    text-align: center;
    position: relative;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .error-content {
    position: relative;
    z-index: 1;
  }
  
  .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
    filter: drop-shadow(0 4px 12px rgba(255, 193, 7, 0.3));
  }
  
  .error-title {
    margin: 0 0 16px 0;
    font-size: 24px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.9);
  }
  
  .error-message {
    margin: 0 0 24px 0;
    font-size: 16px;
    color: rgba(0, 0, 0, 0.7);
    line-height: 1.5;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  }
  
  .error-details {
    margin: 24px 0;
    text-align: left;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 8px;
    padding: 16px;
  }
  
  .error-details summary {
    cursor: pointer;
    font-weight: 600;
    margin-bottom: 12px;
    color: rgba(0, 0, 0, 0.8);
  }
  
  .error-stack {
    font-size: 14px;
    color: rgba(0, 0, 0, 0.7);
  }
  
  .error-stack-trace,
  .error-info pre {
    background: rgba(0, 0, 0, 0.05);
    padding: 12px;
    border-radius: 6px;
    margin: 8px 0;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.4;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .error-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 24px;
  }
  
  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .error-fallback {
      background: rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.1);
    }
    
    .error-title {
      color: rgba(255, 255, 255, 0.95);
    }
    
    .error-message {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .error-details {
      background: rgba(255, 255, 255, 0.05);
    }
    
    .error-details summary {
      color: rgba(255, 255, 255, 0.9);
    }
    
    .error-stack {
      color: rgba(255, 255, 255, 0.8);
    }
    
    .error-stack-trace,
    .error-info pre {
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.9);
    }
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .error-fallback {
      margin: 8px;
      padding: 24px 16px;
    }
    
    .error-icon {
      font-size: 36px;
      margin-bottom: 12px;
    }
    
    .error-title {
      font-size: 20px;
      margin-bottom: 12px;
    }
    
    .error-message {
      font-size: 14px;
      margin-bottom: 20px;
    }
    
    .error-details {
      margin: 16px 0;
      padding: 12px;
    }
    
    .error-stack-trace,
    .error-info pre {
      padding: 8px;
      font-size: 11px;
    }
    
    .error-actions {
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
    }
  }
</style> 