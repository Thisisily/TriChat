<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import LoadingSpinner from './LoadingSpinner.svelte';

  // Props
  export let state: 'connecting' | 'processing' | 'thinking' | 'trinity' | 'completing' | 'error' = 'processing';
  export let progress: number = 0;
  export let showProgress = false;
  export let message = '';
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let className = '';

  // State configurations
  const stateConfig = {
    connecting: {
      message: message || 'Connecting to Trinity',
      color: '#6366f1',
      icon: '🔗',
      showSpinner: true,
    },
    processing: {
      message: message || 'Processing Request',
      color: '#10b981',
      icon: '⚙️',
      showSpinner: true,
    },
    thinking: {
      message: message || 'AI is Thinking',
      color: '#f59e0b',
      icon: '🧠',
      showSpinner: false,
    },
    trinity: {
      message: message || 'Trinity Mode Active',
      color: '#8b5cf6',
      icon: '🔮',
      showSpinner: false,
    },
    completing: {
      message: message || 'Finalizing Response',
      color: '#06b6d4',
      icon: '✨',
      showSpinner: true,
    },
    error: {
      message: message || 'Connection Error',
      color: '#ef4444',
      icon: '⚠️',
      showSpinner: false,
    },
  };

  $: config = stateConfig[state];

  // Animation state
  let mounted = false;
  let animationId: number | null = null;

  // Pulse animation for thinking dots
  let pulseElements: HTMLElement[] = [];
  
  const animatePulse = () => {
    if (!mounted || state !== 'thinking') return;

    const now = Date.now();
    pulseElements.forEach((element, index) => {
      if (element) {
        const delay = index * 300;
        const phase = (now + delay) / 1000;
        const opacity = 0.3 + 0.7 * (Math.sin(phase) + 1) / 2;
        element.style.opacity = opacity.toString();
      }
    });

    animationId = requestAnimationFrame(animatePulse);
  };

  $: if (mounted && state === 'thinking') {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(animatePulse);
  } else if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  onMount(() => {
    mounted = true;
    if (state === 'thinking') {
      animationId = requestAnimationFrame(animatePulse);
    }
  });

  onDestroy(() => {
    mounted = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });
</script>

<div 
  class="streaming-states {className} {state} {size}"
  style="--primary-color: {config.color};"
  role="status"
  aria-live="polite"
  aria-label={config.message}
>
  <div class="state-header">
    <div class="icon-container">
      <span class="state-icon">{config.icon}</span>
    </div>

    <div class="text-content">
      <h3 class="main-message">{config.message}</h3>
    </div>

    {#if config.showSpinner}
      <div class="spinner-container">
        <LoadingSpinner size="small" />
      </div>
    {/if}
  </div>

  {#if showProgress}
    <div class="progress-container">
      <div class="progress-bar">
        <div 
          class="progress-fill"
          style="width: {Math.min(Math.max(progress, 0), 100)}%"
        ></div>
      </div>
      <span class="progress-text">{Math.round(progress)}%</span>
    </div>
  {/if}

  {#if state === 'thinking'}
    <div class="thinking-dots">
      <div class="dot" bind:this={pulseElements[0]}></div>
      <div class="dot" bind:this={pulseElements[1]}></div>
      <div class="dot" bind:this={pulseElements[2]}></div>
    </div>
  {/if}

  {#if state === 'trinity'}
    <div class="trinity-indicators">
      <div class="agent-indicator">
        <span class="agent-icon">📊</span>
        <span class="agent-label">Analytical</span>
      </div>
      <div class="agent-indicator">
        <span class="agent-icon">🎨</span>
        <span class="agent-label">Creative</span>
      </div>
      <div class="agent-indicator">
        <span class="agent-icon">📖</span>
        <span class="agent-label">Factual</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .streaming-states {
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 16px;
    padding: 16px 20px;
    backdrop-filter: blur(8px);
    color: var(--primary-color);
    transition: all 0.3s ease;
    animation: slideIn 0.4s ease-out;
  }

  .state-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .icon-container {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .state-icon {
    font-size: 20px;
    line-height: 1;
  }

  .text-content {
    flex: 1;
  }

  .main-message {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--primary-color);
  }

  .spinner-container {
    flex-shrink: 0;
  }

  .progress-container {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary-color);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 12px;
    font-weight: 500;
    color: var(--primary-color);
    min-width: 35px;
    text-align: right;
  }

  .thinking-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: 12px;
    padding: 8px;
  }

  .thinking-dots .dot {
    width: 6px;
    height: 6px;
    background: var(--primary-color);
    border-radius: 50%;
    opacity: 0.3;
  }

  .trinity-indicators {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 12px;
  }

  .agent-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px;
    border-radius: 8px;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.2);
    animation: pulse 2s ease-in-out infinite;
  }

  .agent-icon {
    font-size: 14px;
  }

  .agent-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--primary-color);
  }

  .streaming-states.small {
    padding: 12px 16px;
    border-radius: 12px;
  }

  .streaming-states.small .main-message {
    font-size: 13px;
  }

  .streaming-states.large {
    padding: 20px 24px;
    border-radius: 20px;
  }

  .streaming-states.large .main-message {
    font-size: 17px;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  @media (prefers-color-scheme: dark) {
    .streaming-states {
      background: rgba(0, 0, 0, 0.6);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .progress-bar {
      background: rgba(255, 255, 255, 0.1);
    }
  }
</style> 