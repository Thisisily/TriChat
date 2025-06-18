<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Props
  export let isVisible = false;
  export let userDisplayName = '';
  export let variant: 'user' | 'ai' | 'trinity' = 'ai';
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let className = '';
  export let showAvatar = true;
  export let customMessage = '';

  // Animation state
  let mounted = false;
  let animationFrame: number | null = null;
  let dotElements: HTMLElement[] = [];

  // Variant configurations
  const variantConfig = {
    user: {
      message: userDisplayName ? `${userDisplayName} is typing` : 'Someone is typing',
      dotColor: '#6366f1',
      bgColor: 'rgba(99, 102, 241, 0.1)',
      borderColor: 'rgba(99, 102, 241, 0.2)',
      avatar: '👤',
    },
    ai: {
      message: customMessage || 'AI is thinking',
      dotColor: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.2)',
      avatar: '🤖',
    },
    trinity: {
      message: customMessage || 'Trinity agents are collaborating',
      dotColor: '#8b5cf6',
      bgColor: 'rgba(139, 92, 246, 0.1)',
      borderColor: 'rgba(139, 92, 246, 0.2)',
      avatar: '🔮',
    },
  };

  // Size configurations
  const sizeConfig = {
    small: {
      fontSize: '12px',
      dotSize: '4px',
      spacing: '8px',
      padding: '6px 10px',
      avatarSize: '16px',
    },
    medium: {
      fontSize: '14px',
      dotSize: '6px',
      spacing: '12px',
      padding: '8px 12px',
      avatarSize: '20px',
    },
    large: {
      fontSize: '16px',
      dotSize: '8px',
      spacing: '16px',
      padding: '10px 16px',
      avatarSize: '24px',
    },
  };

  $: config = variantConfig[variant];
  $: sizeValues = sizeConfig[size];

  // Advanced dot animation
  const animateDots = () => {
    if (!isVisible || !mounted || dotElements.length === 0) return;

    const now = Date.now();
    dotElements.forEach((dot, index) => {
      if (dot) {
        const delay = index * 200; // 200ms delay between dots
        const phase = (now + delay) / 600; // 600ms cycle
        const opacity = 0.3 + 0.7 * (Math.sin(phase) + 1) / 2;
        const scale = 0.8 + 0.4 * (Math.sin(phase + Math.PI / 4) + 1) / 2;
        
        dot.style.opacity = opacity.toString();
        dot.style.transform = `scale(${scale})`;
      }
    });

    animationFrame = requestAnimationFrame(animateDots);
  };

  // Start animation when visible
  $: if (isVisible && mounted) {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    animationFrame = requestAnimationFrame(animateDots);
  } else if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  onMount(() => {
    mounted = true;
    if (isVisible) {
      animationFrame = requestAnimationFrame(animateDots);
    }
  });

  onDestroy(() => {
    mounted = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });

  // Trinity mode special effects
  let trinityGlow = false;
  $: if (variant === 'trinity' && isVisible) {
    const interval = setInterval(() => {
      trinityGlow = !trinityGlow;
    }, 1500);
    
    onDestroy(() => clearInterval(interval));
  }
</script>

{#if isVisible}
  <div 
    class="typing-indicator {className} {variant} {size}"
    class:trinity-glow={variant === 'trinity' && trinityGlow}
    style="
      --dot-color: {config.dotColor};
      --bg-color: {config.bgColor};
      --border-color: {config.borderColor};
      --font-size: {sizeValues.fontSize};
      --dot-size: {sizeValues.dotSize};
      --spacing: {sizeValues.spacing};
      --padding: {sizeValues.padding};
      --avatar-size: {sizeValues.avatarSize};
    "
    role="status"
    aria-live="polite"
    aria-label={config.message}
  >
    <!-- Avatar (optional) -->
    {#if showAvatar}
      <div class="avatar">
        <span class="avatar-emoji">{config.avatar}</span>
      </div>
    {/if}

    <!-- Message and dots -->
    <div class="content">
      <span class="message">{config.message}</span>
      
      <div class="dots-container">
        <div 
          class="dot" 
          bind:this={dotElements[0]}
          style="animation-delay: 0ms"
        ></div>
        <div 
          class="dot" 
          bind:this={dotElements[1]}
          style="animation-delay: 200ms"
        ></div>
        <div 
          class="dot" 
          bind:this={dotElements[2]}
          style="animation-delay: 400ms"
        ></div>
      </div>
    </div>

    <!-- Trinity mode special effect -->
    {#if variant === 'trinity'}
      <div class="trinity-sparkles">
        <span class="sparkle" style="animation-delay: 0ms">✨</span>
        <span class="sparkle" style="animation-delay: 500ms">⭐</span>
        <span class="sparkle" style="animation-delay: 1000ms">💫</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .typing-indicator {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing);
    padding: var(--padding);
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    font-size: var(--font-size);
    font-weight: 500;
    color: var(--dot-color);
    backdrop-filter: blur(8px);
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
    animation: slideIn 0.3s ease-out;
  }

  .typing-indicator.trinity-glow {
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
  }

  /* Avatar */
  .avatar {
    flex-shrink: 0;
    width: var(--avatar-size);
    height: var(--avatar-size);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }

  .avatar-emoji {
    font-size: calc(var(--avatar-size) * 0.7);
    line-height: 1;
  }

  /* Content */
  .content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .message {
    white-space: nowrap;
    opacity: 0.8;
  }

  /* Dots container */
  .dots-container {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: 4px;
  }

  .dot {
    width: var(--dot-size);
    height: var(--dot-size);
    background: var(--dot-color);
    border-radius: 50%;
    animation: pulse 1.2s ease-in-out infinite;
  }

  /* Trinity sparkles */
  .trinity-sparkles {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .sparkle {
    position: absolute;
    font-size: 10px;
    opacity: 0;
    animation: sparkle 3s ease-in-out infinite;
  }

  .sparkle:nth-child(1) {
    top: 20%;
    left: 15%;
  }

  .sparkle:nth-child(2) {
    top: 60%;
    right: 20%;
  }

  .sparkle:nth-child(3) {
    bottom: 30%;
    left: 60%;
  }

  /* Size variants */
  .typing-indicator.small {
    border-radius: 16px;
  }

  .typing-indicator.large {
    border-radius: 24px;
  }

  /* Variant-specific styling */
  .typing-indicator.user {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(79, 70, 229, 0.1));
  }

  .typing-indicator.ai {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1));
  }

  .typing-indicator.trinity {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.1));
    position: relative;
  }

  .typing-indicator.trinity::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    animation: shimmer 2s ease-in-out infinite;
  }

  /* Animations */
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes pulse {
    0%, 60%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    30% {
      transform: scale(1.2);
      opacity: 0.7;
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

  @keyframes sparkle {
    0%, 100% {
      opacity: 0;
      transform: scale(0.5) rotate(0deg);
    }
    50% {
      opacity: 1;
      transform: scale(1) rotate(180deg);
    }
  }

  /* Hover effects */
  .typing-indicator:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--border-color);
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .avatar {
      background: rgba(0, 0, 0, 0.3);
    }

    .typing-indicator {
      backdrop-filter: blur(12px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .typing-indicator {
      animation: none;
    }

    .dot {
      animation: none;
      opacity: 1;
    }

    .sparkle {
      animation: none;
      opacity: 0.3;
    }

    .typing-indicator.trinity::before {
      animation: none;
    }
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .typing-indicator.medium {
      --font-size: 13px;
      --padding: 6px 10px;
      --spacing: 10px;
    }

    .typing-indicator.large {
      --font-size: 14px;
      --padding: 8px 12px;
      --spacing: 12px;
    }

    .message {
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
</style> 