<script lang="ts">
  import { spring } from 'svelte/motion';
  import { onMount } from 'svelte';
  
  export let variant: 'primary' | 'secondary' | 'ghost' = 'primary';
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let disabled = false;
  export let className = '';
  export let onClick: (() => void) | undefined = undefined;
  
  let buttonEl: HTMLButtonElement;
  let ripples: Array<{ x: number; y: number; id: number }> = [];
  let nextId = 0;
  
  // Spring animations for smooth interactions
  const scale = spring(1, { stiffness: 300, damping: 20 });
  const tilt = spring({ x: 0, y: 0 }, { stiffness: 200, damping: 15 });
  
  function handleMouseMove(e: MouseEvent) {
    if (!buttonEl || disabled) return;
    
    const rect = buttonEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Calculate tilt based on mouse position
    tilt.set({
      x: (y - 0.5) * 10,
      y: (x - 0.5) * -10
    });
  }
  
  function handleMouseLeave() {
    tilt.set({ x: 0, y: 0 });
    scale.set(1);
  }
  
  function handleMouseDown(e: MouseEvent) {
    if (disabled) return;
    
    scale.set(0.95);
    
    // Add ripple effect
    const rect = buttonEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ripple = { x, y, id: nextId++ };
    ripples = [...ripples, ripple];
    
    // Remove ripple after animation
    setTimeout(() => {
      ripples = ripples.filter(r => r.id !== ripple.id);
    }, 600);
  }
  
  function handleMouseUp() {
    scale.set(1);
  }
  
  function handleClick() {
    if (onClick && !disabled) {
      onClick();
    }
  }
  
  $: sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-5 py-2.5 text-base',
    large: 'px-7 py-3.5 text-lg'
  }[size];
</script>

<button
  bind:this={buttonEl}
  class="liquid-glass-button liquid-glass-button-{variant} {sizeClasses} {className}"
  {disabled}
  on:click={handleClick}
  on:mousedown={handleMouseDown}
  on:mouseup={handleMouseUp}
  on:mousemove={handleMouseMove}
  on:mouseleave={handleMouseLeave}
  style="
    transform: 
      perspective(1000px)
      scale({$scale})
      rotateX({$tilt.x}deg)
      rotateY({$tilt.y}deg);
  "
>
  <div class="button-backdrop"></div>
  <div class="button-content">
    <slot />
  </div>
  <div class="button-shine"></div>
  
  <!-- Ripple effects -->
  {#each ripples as ripple (ripple.id)}
    <div 
      class="ripple" 
      style="left: {ripple.x}px; top: {ripple.y}px;"
    />
  {/each}
</button>

<style>
  .liquid-glass-button {
    position: relative;
    border-radius: 12px;
    font-weight: 500;
    cursor: pointer;
    overflow: hidden;
    border: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    transform-style: preserve-3d;
  }
  
  .liquid-glass-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  .button-backdrop {
    position: absolute;
    inset: 0;
    backdrop-filter: blur(16px) saturate(180%);
    border-radius: inherit;
    z-index: 0;
  }
  
  .button-content {
    position: relative;
    z-index: 2;
  }
  
  .button-shine {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(255, 255, 255, 0.3) 50%,
      transparent 60%
    );
    transform: translateX(-100%);
    transition: transform 0.6s;
    z-index: 1;
  }
  
  .liquid-glass-button:hover:not(:disabled) .button-shine {
    transform: translateX(100%);
  }
  
  /* Primary variant */
  .liquid-glass-button-primary {
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.4),
      rgba(118, 75, 162, 0.3)
    );
    color: white;
    box-shadow: 
      0 4px 16px rgba(102, 126, 234, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  }
  
  .liquid-glass-button-primary:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.5),
      rgba(118, 75, 162, 0.4)
    );
    box-shadow: 
      0 6px 20px rgba(102, 126, 234, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      inset 0 -1px 0 rgba(0, 0, 0, 0.15);
  }
  
  /* Secondary variant */
  .liquid-glass-button-secondary {
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.08)
    );
    color: rgba(0, 0, 0, 0.8);
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  }
  
  /* Ghost variant */
  .liquid-glass-button-ghost {
    background: transparent;
    color: rgba(0, 0, 0, 0.7);
    box-shadow: none;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .liquid-glass-button-ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.3);
  }
  
  /* Ripple effect */
  .ripple {
    position: absolute;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.5);
    pointer-events: none;
    animation: ripple 0.6s ease-out;
    z-index: 3;
  }
  
  @keyframes ripple {
    from {
      width: 0;
      height: 0;
      opacity: 1;
    }
    to {
      width: 300px;
      height: 300px;
      opacity: 0;
    }
  }
  
  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .liquid-glass-button-primary {
      background: linear-gradient(
        135deg,
        rgba(147, 139, 250, 0.4),
        rgba(236, 72, 153, 0.3)
      );
    }
    
    .liquid-glass-button-secondary {
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.12),
        rgba(255, 255, 255, 0.06)
      );
      color: rgba(255, 255, 255, 0.9);
    }
    
    .liquid-glass-button-ghost {
      color: rgba(255, 255, 255, 0.8);
      border-color: rgba(255, 255, 255, 0.15);
    }
  }
</style> 