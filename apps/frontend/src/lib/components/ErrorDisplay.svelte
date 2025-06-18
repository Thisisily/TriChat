<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    errorState, 
    hasActiveError, 
    canRetry, 
    streamingErrorHandler,
    clearError,
    setRetrying,
    StreamingErrorType,
    type StreamingError
  } from '../error-handler';
  import { connectionUtils } from '../connection-manager';

  // Props
  export let showSystemHealth = true;
  export let autoHide = true;
  export let autoHideDelay = 5000;
  export let className = '';
  export let position: 'top' | 'bottom' | 'center' = 'top';

  // Component state
  let autoHideTimer: NodeJS.Timeout | null = null;
  let mounted = false;

  // Reactive state
  $: currentError = $errorState.currentError;
  $: isRetrying = $errorState.isRetrying;
  $: retryCount = $errorState.retryCount;
  $: systemHealth = $errorState.systemHealth;
  $: showError = $hasActiveError && mounted;

  // Handle retry action
  const handleRetry = async () => {
    if (!currentError || isRetrying) return;

    setRetrying(true, retryCount + 1);

    try {
      // Different retry strategies based on error type
      switch (currentError.type) {
        case StreamingErrorType.CONNECTION:
        case StreamingErrorType.NETWORK:
          await connectionUtils.reconnect();
          break;
        
        case StreamingErrorType.AUTHENTICATION:
          // Redirect to login or trigger auth refresh
          window.location.href = '/auth/login';
          break;
        
        case StreamingErrorType.TIMEOUT:
          await connectionUtils.connect();
          break;
        
        default:
          await connectionUtils.reconnect();
      }

      // Clear error on successful retry
      clearError();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setRetrying(false);
    }
  };

  // Handle dismiss action
  const handleDismiss = () => {
    clearError();
    clearAutoHideTimer();
  };

  // Handle system health action
  const handleSystemHealthAction = () => {
    const health = streamingErrorHandler.getSystemHealth();
    
    if (health.status === 'critical') {
      // Show detailed error information or redirect to help
      console.log('System health critical:', health);
    } else if (health.status === 'degraded') {
      // Attempt to improve connection
      connectionUtils.reconnect();
    }
  };

  // Auto-hide functionality
  const setupAutoHide = () => {
    if (!autoHide || !currentError) return;

    clearAutoHideTimer();

    // Don't auto-hide critical errors that require user action
    if (currentError.type === StreamingErrorType.AUTHENTICATION || 
        currentError.type === StreamingErrorType.QUOTA_EXCEEDED) {
      return;
    }

    autoHideTimer = setTimeout(() => {
      if (mounted) {
        handleDismiss();
      }
    }, autoHideDelay);
  };

  const clearAutoHideTimer = () => {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
  };

  // Get error icon based on type
  const getErrorIcon = (errorType: StreamingErrorType): string => {
    switch (errorType) {
      case StreamingErrorType.CONNECTION:
      case StreamingErrorType.NETWORK:
        return '🔌';
      case StreamingErrorType.AUTHENTICATION:
        return '🔒';
      case StreamingErrorType.TIMEOUT:
        return '⏱️';
      case StreamingErrorType.RATE_LIMIT:
        return '🚦';
      case StreamingErrorType.QUOTA_EXCEEDED:
        return '📊';
      case StreamingErrorType.MODEL_ERROR:
        return '🤖';
      case StreamingErrorType.PARSING:
        return '📝';
      case StreamingErrorType.SERVER:
        return '🖥️';
      default:
        return '⚠️';
    }
  };

  // Get system health color
  const getHealthColor = (health: string): string => {
    switch (health) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Lifecycle
  onMount(() => {
    mounted = true;
  });

  onDestroy(() => {
    mounted = false;
    clearAutoHideTimer();
  });

  // Setup auto-hide when error changes
  $: if (currentError && mounted) {
    setupAutoHide();
  }
</script>

{#if showError && currentError}
  <div 
    class="error-display {className} error-display--{position}"
    role="alert"
    aria-live="polite"
    aria-atomic="true"
  >
    <div class="error-content">
      <!-- Error icon and type -->
      <div class="error-header">
        <span class="error-icon" aria-hidden="true">
          {getErrorIcon(currentError.type)}
        </span>
        <div class="error-info">
          <h3 class="error-title">Connection Issue</h3>
          <p class="error-message">{currentError.userMessage}</p>
        </div>
      </div>

      <!-- Error details (expandable) -->
      {#if currentError.message !== currentError.userMessage}
        <details class="error-details">
          <summary>Technical Details</summary>
          <p class="error-technical">
            <strong>Error Code:</strong> {currentError.code}<br>
            <strong>Type:</strong> {currentError.type}<br>
            <strong>Message:</strong> {currentError.message}<br>
            <strong>Time:</strong> {currentError.timestamp.toLocaleTimeString()}
          </p>
        </details>
      {/if}

      <!-- Actions -->
      <div class="error-actions">
        {#if currentError.retryable && $canRetry}
          <button 
            class="retry-btn"
            on:click={handleRetry}
            disabled={isRetrying}
            aria-label="Retry connection"
          >
            {#if isRetrying}
              <span class="spinner" aria-hidden="true"></span>
              Retrying...
            {:else}
              🔄 Retry
            {/if}
          </button>
        {/if}

        {#if currentError.type === StreamingErrorType.AUTHENTICATION}
          <button 
            class="auth-btn"
            on:click={() => window.location.href = '/auth/login'}
            aria-label="Sign in again"
          >
            🔑 Sign In
          </button>
        {/if}

        <button 
          class="dismiss-btn"
          on:click={handleDismiss}
          aria-label="Dismiss error"
        >
          ✕
        </button>
      </div>

      <!-- Retry progress -->
      {#if retryCount > 0}
        <div class="retry-info">
          <span class="retry-count">Attempt {retryCount}</span>
          {#if currentError.maxRetries}
            <span class="retry-max">of {currentError.maxRetries}</span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- System health indicator -->
    {#if showSystemHealth && systemHealth !== 'healthy'}
      <div class="health-indicator">
        <button 
          class="health-btn {getHealthColor(systemHealth)}"
          on:click={handleSystemHealthAction}
          title="System health: {systemHealth}"
        >
          <span class="health-icon">
            {systemHealth === 'critical' ? '🔴' : '🟡'}
          </span>
          <span class="health-text">
            System {systemHealth}
          </span>
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .error-display {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    max-width: 500px;
    width: 90%;
    z-index: 50;
    animation: slideIn 0.3s ease-out;
  }

  .error-display--top {
    top: 20px;
  }

  .error-display--bottom {
    bottom: 20px;
  }

  .error-display--center {
    top: 50%;
    transform: translate(-50%, -50%);
  }

  .error-content {
    background: white;
    border: 1px solid #ef4444;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(8px);
    position: relative;
  }

  .error-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }

  .error-icon {
    font-size: 24px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .error-info {
    flex: 1;
    min-width: 0;
  }

  .error-title {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  .error-message {
    margin: 0;
    font-size: 14px;
    color: #6b7280;
    line-height: 1.4;
  }

  .error-details {
    margin: 12px 0;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
  }

  .error-details summary {
    padding: 8px 12px;
    background: #f9fafb;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #6b7280;
    border: none;
    outline: none;
  }

  .error-details summary:hover {
    background: #f3f4f6;
  }

  .error-technical {
    padding: 12px;
    margin: 0;
    font-size: 12px;
    font-family: 'Monaco', 'Menlo', monospace;
    color: #4b5563;
    background: #f9fafb;
    line-height: 1.5;
  }

  .error-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .retry-btn,
  .auth-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: #3b82f6;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .retry-btn:hover,
  .auth-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .retry-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .auth-btn {
    background: #059669;
  }

  .auth-btn:hover {
    background: #047857;
  }

  .dismiss-btn {
    margin-left: auto;
    padding: 8px;
    border: none;
    background: transparent;
    color: #6b7280;
    font-size: 16px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .dismiss-btn:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .retry-info {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
    font-size: 12px;
    color: #6b7280;
    text-align: center;
  }

  .health-indicator {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
  }

  .health-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid currentColor;
    border-radius: 6px;
    background: transparent;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    width: fit-content;
  }

  .health-btn:hover {
    background: currentColor;
    color: white;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* Animations */
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .error-content {
      background: #1f2937;
      border-color: #ef4444;
      color: #f9fafb;
    }

    .error-title {
      color: #f9fafb;
    }

    .error-message {
      color: #d1d5db;
    }

    .error-details {
      border-color: #374151;
    }

    .error-details summary {
      background: #374151;
      color: #d1d5db;
    }

    .error-details summary:hover {
      background: #4b5563;
    }

    .error-technical {
      background: #374151;
      color: #d1d5db;
    }

    .dismiss-btn:hover {
      background: #374151;
      color: #f9fafb;
    }

    .retry-info {
      border-color: #374151;
      color: #9ca3af;
    }

    .health-indicator {
      border-color: #374151;
    }
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .error-display {
      width: 95%;
      max-width: none;
    }

    .error-content {
      padding: 12px;
    }

    .error-header {
      gap: 10px;
    }

    .error-icon {
      font-size: 20px;
    }

    .error-title {
      font-size: 15px;
    }

    .error-message {
      font-size: 13px;
    }

    .error-actions {
      gap: 6px;
    }

    .retry-btn,
    .auth-btn {
      padding: 6px 12px;
      font-size: 13px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .error-display {
      animation: none;
    }

    .spinner {
      animation: none;
    }

    .retry-btn:hover,
    .auth-btn:hover {
      transform: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .error-content {
      border-width: 2px;
    }

    .retry-btn,
    .auth-btn {
      border: 1px solid currentColor;
    }
  }
</style> 