<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  
  const dispatch = createEventDispatcher<{
    dismiss: void;
  }>();
  
  export let type: 'success' | 'error' | 'warning' | 'info' = 'info';
  export let title: string = '';
  export let message: string;
  export let duration: number = 5000; // Auto dismiss after 5 seconds
  export let dismissible = true;
  export let showIcon = true;
  export let persistent = false; // If true, won't auto-dismiss
  
  let visible = true;
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const colors = {
    success: {
      bg: 'rgba(34, 197, 94, 0.1)',
      border: 'rgba(34, 197, 94, 0.3)',
      text: 'rgba(21, 128, 61, 1)',
      icon: 'rgba(34, 197, 94, 1)'
    },
    error: {
      bg: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.3)',
      text: 'rgba(153, 27, 27, 1)',
      icon: 'rgba(239, 68, 68, 1)'
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.3)',
      text: 'rgba(146, 64, 14, 1)',
      icon: 'rgba(245, 158, 11, 1)'
    },
    info: {
      bg: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.3)',
      text: 'rgba(30, 64, 175, 1)',
      icon: 'rgba(59, 130, 246, 1)'
    }
  };
  
  function handleDismiss() {
    visible = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Wait for exit animation before dispatching
    setTimeout(() => {
      dispatch('dismiss');
    }, 300);
  }
  
  onMount(() => {
    if (!persistent && duration > 0) {
      timeoutId = setTimeout(handleDismiss, duration);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  });
</script>

{#if visible}
  <div 
    class="toast toast-{type}"
    style="
      --toast-bg: {colors[type].bg};
      --toast-border: {colors[type].border};
      --toast-text: {colors[type].text};
      --toast-icon: {colors[type].icon};
    "
    in:fly={{ x: 300, duration: 300 }}
    out:fly={{ x: 300, duration: 300 }}
    role="alert"
    aria-live="polite"
  >
    <div class="toast-content">
      {#if showIcon}
        <div class="toast-icon">
          {icons[type]}
        </div>
      {/if}
      
      <div class="toast-text">
        {#if title}
          <div class="toast-title">{title}</div>
        {/if}
        <div class="toast-message">{message}</div>
      </div>
      
      {#if dismissible}
        <button 
          class="toast-close"
          on:click={handleDismiss}
          aria-label="Dismiss notification"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      {/if}
    </div>
    
    {#if !persistent && duration > 0}
      <div class="toast-progress">
        <div 
          class="toast-progress-bar"
          style="animation-duration: {duration}ms"
        ></div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .toast {
    background: var(--toast-bg);
    border: 1px solid var(--toast-border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 8px;
    position: relative;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    min-width: 320px;
    max-width: 480px;
    overflow: hidden;
  }
  
  .toast-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    position: relative;
    z-index: 1;
  }
  
  .toast-icon {
    font-size: 20px;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 2px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }
  
  .toast-text {
    flex: 1;
    min-width: 0;
  }
  
  .toast-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--toast-text);
    margin-bottom: 4px;
    line-height: 1.3;
  }
  
  .toast-message {
    font-size: 14px;
    color: var(--toast-text);
    line-height: 1.4;
    opacity: 0.9;
  }
  
  .toast-close {
    background: none;
    border: none;
    color: var(--toast-text);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    opacity: 0.7;
    transition: all 0.2s ease;
    margin-top: -2px;
  }
  
  .toast-close:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.1);
  }
  
  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  
  .toast-progress-bar {
    height: 100%;
    background: var(--toast-icon);
    animation: progress linear;
    transform-origin: left;
  }
  
  @keyframes progress {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }
  
  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .toast {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    .toast-close:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .toast-progress {
      background: rgba(255, 255, 255, 0.1);
    }
    
    /* Adjust colors for dark mode */
    .toast-success {
      --toast-bg: rgba(34, 197, 94, 0.15);
      --toast-border: rgba(34, 197, 94, 0.4);
      --toast-text: rgba(187, 247, 208, 1);
      --toast-icon: rgba(34, 197, 94, 1);
    }
    
    .toast-error {
      --toast-bg: rgba(239, 68, 68, 0.15);
      --toast-border: rgba(239, 68, 68, 0.4);
      --toast-text: rgba(254, 202, 202, 1);
      --toast-icon: rgba(239, 68, 68, 1);
    }
    
    .toast-warning {
      --toast-bg: rgba(245, 158, 11, 0.15);
      --toast-border: rgba(245, 158, 11, 0.4);
      --toast-text: rgba(253, 230, 138, 1);
      --toast-icon: rgba(245, 158, 11, 1);
    }
    
    .toast-info {
      --toast-bg: rgba(59, 130, 246, 0.15);
      --toast-border: rgba(59, 130, 246, 0.4);
      --toast-text: rgba(191, 219, 254, 1);
      --toast-icon: rgba(59, 130, 246, 1);
    }
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .toast {
      min-width: 280px;
      max-width: calc(100vw - 32px);
      padding: 12px;
      margin-bottom: 6px;
    }
    
    .toast-content {
      gap: 10px;
    }
    
    .toast-icon {
      font-size: 18px;
    }
    
    .toast-title {
      font-size: 13px;
      margin-bottom: 3px;
    }
    
    .toast-message {
      font-size: 13px;
    }
    
    .toast-close {
      padding: 3px;
    }
    
    .toast-close svg {
      width: 14px;
      height: 14px;
    }
  }
</style> 