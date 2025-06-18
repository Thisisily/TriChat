<script lang="ts">
  import { onMount } from 'svelte';
  import LoadingSpinner from './LoadingSpinner.svelte';
  
  export let status: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected';
  export let showLabel = true;
  export let compact = false;
  export let className = '';
  
  let visible = true;
  let hideTimeout: ReturnType<typeof setTimeout>;
  
  const statusConfig = {
    connected: {
      icon: '✅',
      label: 'Connected',
      color: 'rgba(34, 197, 94, 1)',
      bgColor: 'rgba(34, 197, 94, 0.1)',
      borderColor: 'rgba(34, 197, 94, 0.3)'
    },
    connecting: {
      icon: null, // Will use spinner
      label: 'Connecting...',
      color: 'rgba(59, 130, 246, 1)',
      bgColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgba(59, 130, 246, 0.3)'
    },
    disconnected: {
      icon: '⚪',
      label: 'Disconnected',
      color: 'rgba(156, 163, 175, 1)',
      bgColor: 'rgba(156, 163, 175, 0.1)',
      borderColor: 'rgba(156, 163, 175, 0.3)'
    },
    error: {
      icon: '❌',
      label: 'Connection Error',
      color: 'rgba(239, 68, 68, 1)',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.3)'
    }
  };
  
  $: config = statusConfig[status];
  
  // Auto-hide when connected (optional behavior)
  $: if (status === 'connected') {
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      visible = false;
    }, 3000);
  } else {
    if (hideTimeout) clearTimeout(hideTimeout);
    visible = true;
  }
  
  onMount(() => {
    return () => {
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  });
</script>

{#if visible}
  <div 
    class="connection-status {className}"
    class:compact
    style="
      --status-color: {config.color};
      --status-bg: {config.bgColor};
      --status-border: {config.borderColor};
    "
    role="status"
    aria-live="polite"
    aria-label="Connection status: {config.label}"
  >
    <div class="status-indicator">
      {#if status === 'connecting'}
        <LoadingSpinner size="small" variant="glass" />
      {:else}
        <span class="status-icon">{config.icon}</span>
      {/if}
    </div>
    
    {#if showLabel && !compact}
      <span class="status-label">{config.label}</span>
    {/if}
    
    <!-- Pulse animation for connecting state -->
    {#if status === 'connecting'}
      <div class="pulse-ring"></div>
    {/if}
  </div>
{/if}

<style>
  .connection-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 20px;
    background: var(--status-bg);
    border: 1px solid var(--status-border);
    backdrop-filter: blur(8px);
    font-size: 13px;
    font-weight: 500;
    color: var(--status-color);
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  
  .connection-status.compact {
    padding: 6px;
    gap: 0;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
  }
  
  .status-icon {
    font-size: 14px;
    line-height: 1;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
  }
  
  .status-label {
    white-space: nowrap;
    position: relative;
    z-index: 1;
  }
  
  .pulse-ring {
    position: absolute;
    top: 50%;
    left: 8px;
    width: 16px;
    height: 16px;
    border: 2px solid var(--status-color);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    animation: pulse 2s infinite;
    opacity: 0.6;
  }
  
  .compact .pulse-ring {
    left: 50%;
    width: 20px;
    height: 20px;
  }
  
  @keyframes pulse {
    0% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0.8;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 0.4;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.6);
      opacity: 0;
    }
  }
  
  /* Hover effects */
  .connection-status:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--status-bg);
  }
  
  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .connection-status {
      background: rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(12px);
    }
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .connection-status {
      font-size: 12px;
      padding: 6px 10px;
      gap: 6px;
    }
    
    .connection-status.compact {
      padding: 4px;
    }
    
    .status-icon {
      font-size: 12px;
    }
    
    .pulse-ring {
      width: 14px;
      height: 14px;
    }
    
    .compact .pulse-ring {
      width: 18px;
      height: 18px;
    }
  }
  
  /* Animation entrance */
  .connection-status {
    animation: slideIn 0.3s ease-out;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style> 