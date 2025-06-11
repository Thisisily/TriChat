<script lang="ts">
  import { onMount } from 'svelte';
  
  export let className = '';
  export let borderRadius = 24;
  export let padding = '24px';
  export let elasticity = 0.15;
  export let blurAmount = 20;
  export let saturation = 160;
  
  let containerEl: HTMLDivElement;
  let mouseX = 0;
  let mouseY = 0;
  let isHovered = false;
  
  function handleMouseMove(e: MouseEvent) {
    if (!containerEl) return;
    
    const rect = containerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    mouseX = ((e.clientX - centerX) / rect.width) * 100;
    mouseY = ((e.clientY - centerY) / rect.height) * 100;
  }
  
  function handleMouseEnter() {
    isHovered = true;
  }
  
  function handleMouseLeave() {
    isHovered = false;
    // Smoothly return to center
    mouseX = 0;
    mouseY = 0;
  }
  
  $: highlightAngle = 135 + mouseX * 0.5;
  $: highlightPosition = 50 + mouseY * 0.3;
  
  onMount(() => {
    if (containerEl) {
      containerEl.addEventListener('mousemove', handleMouseMove);
      containerEl.addEventListener('mouseenter', handleMouseEnter);
      containerEl.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
        containerEl.removeEventListener('mousemove', handleMouseMove);
        containerEl.removeEventListener('mouseenter', handleMouseEnter);
        containerEl.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  });
</script>

<div 
  bind:this={containerEl}
  class="enhanced-glass {className}"
  style="
    --border-radius: {borderRadius}px;
    --padding: {padding};
    --highlight-angle: {highlightAngle}deg;
    --highlight-position: {highlightPosition}%;
    --blur-amount: {blurAmount}px;
    --saturation: {saturation}%;
    --hover-scale: {isHovered ? 1.02 : 1};
    --mouse-x: {mouseX * elasticity}px;
    --mouse-y: {mouseY * elasticity}px;
  "
>
  <div class="glass-layer"></div>
  <div class="content-layer">
    <slot />
  </div>
  <div class="highlight-layer"></div>
  <div class="border-layer"></div>
</div>

<style>
  .enhanced-glass {
    position: relative;
    border-radius: var(--border-radius);
    padding: var(--padding);
    transform: 
      scale(var(--hover-scale))
      translate(var(--mouse-x), var(--mouse-y));
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .glass-layer {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    backdrop-filter: blur(var(--blur-amount)) saturate(var(--saturation));
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.05)
    );
    z-index: 0;
  }
  
  .content-layer {
    position: relative;
    z-index: 2;
  }
  
  .highlight-layer {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      var(--highlight-angle),
      transparent 0%,
      rgba(255, 255, 255, 0.05) var(--highlight-position),
      transparent 100%
    );
    pointer-events: none;
    z-index: 1;
    opacity: 0.8;
    transition: all 0.3s ease;
  }
  
  .border-layer {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(
      var(--highlight-angle),
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.3) var(--highlight-position),
      rgba(255, 255, 255, 0.1) 100%
    );
    -webkit-mask: 
      linear-gradient(#fff 0 0) content-box, 
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    z-index: 3;
  }
  
  @media (prefers-color-scheme: dark) {
    .glass-layer {
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.08),
        rgba(255, 255, 255, 0.03)
      );
    }
    
    .highlight-layer {
      background: linear-gradient(
        var(--highlight-angle),
        transparent 0%,
        rgba(255, 255, 255, 0.03) var(--highlight-position),
        transparent 100%
      );
    }
  }
</style> 