<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ConnectionStatus from './ConnectionStatus.svelte';
  import { 
    connectionState, 
    isConnected, 
    isConnecting, 
    hasConnectionError, 
    connectionType,
    connectionUtils 
  } from '../connection-manager';

  // Props
  export let autoConnect = true;
  export let showStatus = true;
  export let showControls = false;
  export let className = '';
  export let onConnectionChange: ((connected: boolean) => void) | undefined = undefined;

  // Local state
  let mounted = false;
  let showReconnectDialog = false;
  let reconnectAttempts = 0;
  let maxReconnectAttempts = 5;

  // Reactive connection status for the status component
  $: connectionStatus = $isConnected ? 'connected' : 
                       $isConnecting ? 'connecting' : 
                       $hasConnectionError ? 'error' : 'disconnected';

  // Handle connection state changes
  $: if (mounted && onConnectionChange) {
    onConnectionChange($isConnected);
  }

  // Handle error states and reconnection dialog
  $: if ($hasConnectionError && reconnectAttempts < maxReconnectAttempts) {
    showReconnectDialog = true;
  }

  // Connection control handlers
  const handleConnect = async () => {
    const success = await connectionUtils.connect();
    if (success) {
      reconnectAttempts = 0;
      showReconnectDialog = false;
    }
  };

  const handleDisconnect = () => {
    connectionUtils.disconnect();
    showReconnectDialog = false;
  };

  const handleReconnect = async () => {
    reconnectAttempts++;
    showReconnectDialog = false;
    
    const success = await connectionUtils.reconnect();
    if (success) {
      reconnectAttempts = 0;
    } else if (reconnectAttempts < maxReconnectAttempts) {
      // Show dialog again after a delay if reconnection failed
      setTimeout(() => {
        if (!$isConnected) {
          showReconnectDialog = true;
        }
      }, 3000);
    }
  };

  const handleDismissDialog = () => {
    showReconnectDialog = false;
    reconnectAttempts = maxReconnectAttempts; // Prevent showing again
  };

  // Auto-connect on mount if enabled
  onMount(async () => {
    mounted = true;
    
    if (autoConnect && !$isConnected) {
      await connectionUtils.connect();
    }
  });

  onDestroy(() => {
    mounted = false;
  });

  // Format connection type for display
  const formatConnectionType = (type: string): string => {
    switch (type) {
      case 'websocket': return 'WebSocket';
      case 'sse': return 'Server-Sent Events';
      case 'none': return 'No Connection';
      default: return type;
    }
  };

  // Get connection latency color
  const getLatencyColor = (latency?: number): string => {
    if (!latency) return '#9ca3af';
    if (latency < 100) return '#10b981'; // green
    if (latency < 300) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };
</script>

<div class="connection-manager {className}">
  <!-- Connection Status Display -->
  {#if showStatus}
    <div class="status-section">
      <ConnectionStatus 
        status={connectionStatus}
        showLabel={true}
        compact={false}
      />
      
      <!-- Connection Details -->
      {#if $isConnected && $connectionState.connectionType}
        <div class="connection-details">
          <span class="connection-type">
            {formatConnectionType($connectionType)}
          </span>
          
          {#if $connectionState.latency}
            <span 
              class="latency" 
              style="color: {getLatencyColor($connectionState.latency)}"
            >
              {$connectionState.latency}ms
            </span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Connection Controls -->
  {#if showControls}
    <div class="controls-section">
      {#if $isConnected}
        <button 
          class="control-button disconnect" 
          on:click={handleDisconnect}
          title="Disconnect from streaming service"
        >
          Disconnect
        </button>
      {:else if $isConnecting}
        <button 
          class="control-button cancel" 
          on:click={handleDisconnect}
          title="Cancel connection attempt"
        >
          Cancel
        </button>
      {:else}
        <button 
          class="control-button connect" 
          on:click={handleConnect}
          title="Connect to streaming service"
        >
          Connect
        </button>
      {/if}
    </div>
  {/if}

  <!-- Reconnection Dialog -->
  {#if showReconnectDialog}
    <div class="reconnect-dialog-backdrop" role="dialog" aria-modal="true">
      <div class="reconnect-dialog">
        <div class="dialog-header">
          <h3>Connection Lost</h3>
          <button 
            class="close-button" 
            on:click={handleDismissDialog}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        
        <div class="dialog-content">
          {#if $connectionState.error}
            <p class="error-message">{$connectionState.error}</p>
          {/if}
          
          <p>
            Your connection to the streaming service was lost. 
            Would you like to reconnect?
          </p>
          
          <div class="attempt-counter">
            Attempt {reconnectAttempts} of {maxReconnectAttempts}
          </div>
        </div>
        
        <div class="dialog-actions">
          <button 
            class="dialog-button secondary" 
            on:click={handleDismissDialog}
          >
            Stay Offline
          </button>
          <button 
            class="dialog-button primary" 
            on:click={handleReconnect}
            disabled={$isConnecting}
          >
            {$isConnecting ? 'Connecting...' : 'Reconnect'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .connection-manager {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
  }

  /* Status Section */
  .status-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .connection-details {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #6b7280;
  }

  .connection-type {
    padding: 2px 6px;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 4px;
    font-weight: 500;
  }

  .latency {
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    font-weight: 500;
    font-family: monospace;
  }

  /* Controls Section */
  .controls-section {
    display: flex;
    gap: 6px;
  }

  .control-button {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .control-button.connect {
    background: #10b981;
    color: white;
  }

  .control-button.connect:hover {
    background: #059669;
  }

  .control-button.disconnect {
    background: #ef4444;
    color: white;
  }

  .control-button.disconnect:hover {
    background: #dc2626;
  }

  .control-button.cancel {
    background: #6b7280;
    color: white;
  }

  .control-button.cancel:hover {
    background: #4b5563;
  }

  /* Reconnection Dialog */
  .reconnect-dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }

  .reconnect-dialog {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 400px;
    width: 90%;
    overflow: hidden;
    animation: slideIn 0.3s ease-out;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 24px;
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: #f3f4f6;
    color: #4b5563;
  }

  .dialog-content {
    padding: 16px 20px;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 13px;
    color: #dc2626;
  }

  .dialog-content p {
    margin: 0 0 12px 0;
    color: #6b7280;
    line-height: 1.5;
  }

  .attempt-counter {
    font-size: 12px;
    color: #9ca3af;
    text-align: center;
    padding: 8px;
    background: #f9fafb;
    border-radius: 6px;
  }

  .dialog-actions {
    display: flex;
    gap: 8px;
    padding: 16px 20px 20px;
    justify-content: flex-end;
  }

  .dialog-button {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .dialog-button.secondary {
    background: #f3f4f6;
    color: #4b5563;
  }

  .dialog-button.secondary:hover {
    background: #e5e7eb;
  }

  .dialog-button.primary {
    background: #6366f1;
    color: white;
  }

  .dialog-button.primary:hover {
    background: #5b21b6;
  }

  .dialog-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Animations */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .reconnect-dialog {
      background: #1f2937;
      color: #f9fafb;
    }

    .dialog-header {
      border-color: #374151;
    }

    .dialog-header h3 {
      color: #f9fafb;
    }

    .close-button:hover {
      background: #374151;
      color: #d1d5db;
    }

    .dialog-content p {
      color: #9ca3af;
    }

    .attempt-counter {
      background: #374151;
      color: #d1d5db;
    }

    .dialog-button.secondary {
      background: #374151;
      color: #d1d5db;
    }

    .dialog-button.secondary:hover {
      background: #4b5563;
    }

    .connection-type {
      background: rgba(99, 102, 241, 0.2);
      border-color: rgba(99, 102, 241, 0.3);
      color: #e5e7eb;
    }

    .latency {
      background: rgba(255, 255, 255, 0.1);
      color: inherit;
    }
  }

  /* Mobile optimization */
  @media (max-width: 768px) {
    .connection-manager {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .reconnect-dialog {
      width: 95%;
      margin: 20px;
    }

    .dialog-actions {
      flex-direction: column;
    }

    .connection-details {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }
</style> 