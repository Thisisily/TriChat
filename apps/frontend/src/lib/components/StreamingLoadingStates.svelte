<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import LoadingSpinner from './LoadingSpinner.svelte';

  // Props
  export let state: 'connecting' | 'processing' | 'thinking' | 'trinity' | 'completing' | 'error' = 'processing';
  export let progress: number = 0; // 0-100 for progress-based states
  export let showProgress = false;
  export let message = '';
  export let subMessage = '';
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let className = '';
  export let showAnimation = true;
  export let trinityPhase: 'agents' | 'orchestrator' | 'blending' = 'agents';

  // Animation state
  let mounted = false;
  let progressElement: HTMLElement;
  let animationId: number | null = null;
  let pulseElements: HTMLElement[] = [];

  // State configurations
  const stateConfig = {
    connecting: {
      message: message || 'Connecting to Trinity',
      subMessage: subMessage || 'Establishing secure connection...',
      color: '#6366f1',
      bgColor: 'rgba(99, 102, 241, 0.1)',
      borderColor: 'rgba(99, 102, 241, 0.2)',
      icon: '🔗',
      showSpinner: true,
    },
    processing: {
      message: message || 'Processing Request',
      subMessage: subMessage || 'Analyzing your message...',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.2)',
      icon: '⚙️',
      showSpinner: true,
    },
    thinking: {
      message: message || 'AI is Thinking',
      subMessage: subMessage || 'Generating thoughtful response...',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.2)',
      icon: '🧠',
      showSpinner: false,
    },
    trinity: {
      message: message || 'Trinity Mode Active',
      subMessage: getTrinitySubMessage(),
      color: '#8b5cf6',
      bgColor: 'rgba(139, 92, 246, 0.1)',
      borderColor: 'rgba(139, 92, 246, 0.2)',
      icon: '🔮',
      showSpinner: false,
    },
    completing: {
      message: message || 'Finalizing Response',
      subMessage: subMessage || 'Applying finishing touches...',
      color: '#06b6d4',
      bgColor: 'rgba(6, 182, 212, 0.1)',
      borderColor: 'rgba(6, 182, 212, 0.2)',
      icon: '✨',
      showSpinner: true,
    },
    error: {
      message: message || 'Connection Error',
      subMessage: subMessage || 'Please check your connection...',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.2)',
      icon: '⚠️',
      showSpinner: false,
    },
  };

  // Size configurations
  const sizeConfig = {
    small: {
      padding: '12px 16px',
      fontSize: '13px',
      iconSize: '16px',
      spinnerSize: 'small',
      spacing: '8px',
    },
    medium: {
      padding: '16px 20px',
      fontSize: '15px',
      iconSize: '20px',
      spinnerSize: 'medium',
      spacing: '12px',
    },
    large: {
      padding: '20px 24px',
      fontSize: '17px',
      iconSize: '24px',
      spinnerSize: 'large',
      spacing: '16px',
    },
  };

  function getTrinitySubMessage(): string {
    if (subMessage) return subMessage;
    
    switch (trinityPhase) {
      case 'agents':
        return 'Analytical, Creative & Factual agents working...';
      case 'orchestrator':
        return 'Orchestrator blending responses...';
      case 'blending':
        return 'Creating unified response...';
      default:
        return 'Trinity agents collaborating...';
    }
  }

  $: config = stateConfig[state];
  $: sizeValues = sizeConfig[size];

  // Progress animation
  const animateProgress = () => {
    if (!showProgress || !progressElement || !showAnimation) return;

    const targetWidth = `${Math.min(Math.max(progress, 0), 100)}%`;
    progressElement.style.width = targetWidth;
  };

  // Pulse animation for thinking dots
  const animatePulse = () => {
    if (!mounted || state !== 'thinking' || !showAnimation) return;

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

  // Trinity special animation
  let trinityRotation = 0;
  const animateTrinity = () => {
    if (state !== 'trinity' || !showAnimation) return;

    trinityRotation = (trinityRotation + 1) % 360;
    
    if (mounted) {
      requestAnimationFrame(animateTrinity);
    }
  };

  // Start appropriate animations based on state
  $: if (mounted && showAnimation) {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    if (state === 'thinking') {
      animationId = requestAnimationFrame(animatePulse);
    } else if (state === 'trinity') {
      animateTrinity();
    }
  }

  // Update progress
  $: if (showProgress && mounted) {
    animateProgress();
  }

  onMount(() => {
    mounted = true;
    if (showAnimation) {
      if (state === 'thinking') {
        animationId = requestAnimationFrame(animatePulse);
      } else if (state === 'trinity') {
        animateTrinity();
      }
    }
    if (showProgress) {
      animateProgress();
    }
  });

  onDestroy(() => {
    mounted = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });

  // Format progress percentage
  const formatProgress = (value: number): string => {
    return `${Math.round(Math.min(Math.max(value, 0), 100))}%`;
  };
</script>

<div 
  class="streaming-loading {className} {state} {size}"
  style="
    --primary-color: {config.color};
    --bg-color: {config.bgColor};
    --border-color: {config.borderColor};
    --padding: {sizeValues.padding};
    --font-size: {sizeValues.fontSize};
    --icon-size: {sizeValues.iconSize};
    --spacing: {sizeValues.spacing};
  "
  role="status"
  aria-live="polite"
  aria-label="{config.message} - {config.subMessage}"
>
  <!-- Header -->
  <div class="loading-header">
    <div class="icon-container">
      {#if state === 'trinity'}
        <div 
          class="trinity-icon"
          style="transform: rotate({trinityRotation}deg)"
        >
          {config.icon}
        </div>
      {:else}
        <span class="state-icon">{config.icon}</span>
      {/if}
    </div>

    <div class="text-content">
      <h3 class="main-message">{config.message}</h3>
      <p class="sub-message">{config.subMessage}</p>
    </div>

    {#if config.showSpinner}
      <div class="spinner-container">
        <LoadingSpinner size={sizeValues.spinnerSize} variant="glass" />
      </div>
    {/if}
  </div>

  <!-- Progress Bar -->
  {#if showProgress}
    <div class="progress-container">
      <div class="progress-bar">
        <div 
          class="progress-fill"
          bind:this={progressElement}
          style="width: 0%"
        ></div>
      </div>
      <span class="progress-text">{formatProgress(progress)}</span>
    </div>
  {/if}

  <!-- Special State Indicators -->
  {#if state === 'thinking'}
    <div class="thinking-dots">
      <div class="dot" bind:this={pulseElements[0]}></div>
      <div class="dot" bind:this={pulseElements[1]}></div>
      <div class="dot" bind:this={pulseElements[2]}></div>
      <div class="dot" bind:this={pulseElements[3]}></div>
      <div class="dot" bind:this={pulseElements[4]}></div>
    </div>
  {/if}

  {#if state === 'trinity'}
    <div class="trinity-indicators">
      <div class="agent-indicator" class:active={trinityPhase === 'agents'}>
        <span class="agent-icon">📊</span>
        <span class="agent-label">Analytical</span>
      </div>
      <div class="agent-indicator" class:active={trinityPhase === 'agents'}>
        <span class="agent-icon">🎨</span>
        <span class="agent-label">Creative</span>
      </div>
      <div class="agent-indicator" class:active={trinityPhase === 'agents'}>
        <span class="agent-icon">📖</span>
        <span class="agent-label">Factual</span>
      </div>
      <div class="orchestrator-indicator" class:active={trinityPhase === 'orchestrator' || trinityPhase === 'blending'}>
        <span class="orchestrator-icon">🎭</span>
        <span class="orchestrator-label">Orchestrator</span>
      </div>
    </div>
  {/if}

  {#if state === 'error'}
    <div class="error-actions">
      <button class="retry-button" on:click>
        Retry Connection
      </button>
    </div>
  {/if}
</div>

<style>
  .streaming-loading {
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: var(--padding);
    backdrop-filter: blur(8px);
    color: var(--primary-color);
    transition: all 0.3s ease;
    animation: slideIn 0.4s ease-out;
    position: relative;
    overflow: hidden;
  }

  .streaming-loading.trinity {
    background: linear-gradient(135deg, var(--bg-color), rgba(139, 92, 246, 0.05));
  }

  .streaming-loading.trinity::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    animation: shimmer 3s ease-in-out infinite;
  }

  /* Header */
  .loading-header {
    display: flex;
    align-items: center;
    gap: var(--spacing);
  }

  .icon-container {
    flex-shrink: 0;
    width: var(--icon-size);
    height: var(--icon-size);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .state-icon {
    font-size: var(--icon-size);
    line-height: 1;
  }

  .trinity-icon {
    font-size: var(--icon-size);
    line-height: 1;
    transition: transform 0.1s ease;
  }

  .text-content {
    flex: 1;
    min-width: 0;
  }

  .main-message {
    margin: 0 0 2px 0;
    font-size: var(--font-size);
    font-weight: 600;
    color: var(--primary-color);
    line-height: 1.2;
  }

  .sub-message {
    margin: 0;
    font-size: calc(var(--font-size) * 0.85);
    color: var(--primary-color);
    opacity: 0.7;
    line-height: 1.3;
  }

  .spinner-container {
    flex-shrink: 0;
  }

  /* Progress Bar */
  .progress-container {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
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
    font-size: calc(var(--font-size) * 0.8);
    font-weight: 500;
    color: var(--primary-color);
    min-width: 35px;
    text-align: right;
  }

  /* Thinking Dots */
  .thinking-dots {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    margin-top: 16px;
    padding: 12px;
  }

  .thinking-dots .dot {
    width: 8px;
    height: 8px;
    background: var(--primary-color);
    border-radius: 50%;
    opacity: 0.3;
    transition: opacity 0.3s ease;
  }

  /* Trinity Indicators */
  .trinity-indicators {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 16px;
  }

  .agent-indicator,
  .orchestrator-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(139, 92, 246, 0.2);
    transition: all 0.3s ease;
    opacity: 0.5;
  }

  .agent-indicator.active,
  .orchestrator-indicator.active {
    opacity: 1;
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.4);
    box-shadow: 0 0 12px rgba(139, 92, 246, 0.2);
  }

  .orchestrator-indicator {
    grid-column: span 3;
    flex-direction: row;
    justify-content: center;
  }

  .agent-icon,
  .orchestrator-icon {
    font-size: 14px;
  }

  .agent-label,
  .orchestrator-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--primary-color);
    opacity: 0.8;
  }

  /* Error Actions */
  .error-actions {
    margin-top: 12px;
    text-align: center;
  }

  .retry-button {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: calc(var(--font-size) * 0.9);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  /* Size variants */
  .streaming-loading.small {
    border-radius: 12px;
  }

  .streaming-loading.large {
    border-radius: 20px;
  }

  /* Animations */
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes shimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .streaming-loading {
      backdrop-filter: blur(12px);
    }

    .agent-indicator,
    .orchestrator-indicator {
      background: rgba(0, 0, 0, 0.2);
    }

    .agent-indicator.active,
    .orchestrator-indicator.active {
      background: rgba(139, 92, 246, 0.2);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .streaming-loading {
      animation: none;
    }

    .streaming-loading.trinity::before {
      animation: none;
    }

    .trinity-icon {
      transition: none;
    }

    .thinking-dots .dot {
      opacity: 0.7;
    }
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .trinity-indicators {
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }

    .orchestrator-indicator {
      grid-column: span 2;
    }

    .agent-label,
    .orchestrator-label {
      font-size: 9px;
    }

    .sub-message {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
</style> 