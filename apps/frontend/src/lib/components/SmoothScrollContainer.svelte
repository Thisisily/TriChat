<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived } from 'svelte/store';

  // Props
  export let autoScroll = true;
  export let scrollThreshold = 100; // Distance from bottom to trigger auto-scroll
  export let smoothScrollDuration = 300; // Duration of smooth scroll animation
  export let newContentIndicator = true;
  export let scrollToBottomButton = true;
  export let className = '';
  export let style = '';

  // Component state
  let container: HTMLElement;
  let isAutoScrolling = false;
  let isUserScrolling = false;
  let userScrollTimeout: NodeJS.Timeout | null = null;
  let animationFrameId: number | null = null;
  let mounted = false;

  // Reactive stores for scroll state
  const scrollState = writable({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    isAtBottom: true,
    distanceFromBottom: 0,
    hasNewContent: false,
  });

  // Derived stores
  const isAtBottom = derived(scrollState, $state => $state.isAtBottom);
  const hasNewContent = derived(scrollState, $state => $state.hasNewContent);
  const distanceFromBottom = derived(scrollState, $state => $state.distanceFromBottom);

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    scroll: { scrollTop: number; isAtBottom: boolean };
    newContent: { visible: boolean };
    userScrollDetected: { direction: 'up' | 'down' };
  }>();

  // Update scroll state
  const updateScrollState = () => {
    if (!container || !mounted) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom <= scrollThreshold;

    scrollState.update(state => ({
      ...state,
      scrollTop,
      scrollHeight,
      clientHeight,
      isAtBottom,
      distanceFromBottom,
    }));

    // Dispatch scroll event
    dispatch('scroll', { scrollTop, isAtBottom });
  };

  // Smooth scroll to bottom
  const scrollToBottom = (smooth = true) => {
    if (!container || !mounted) return;

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (!smooth) {
      container.scrollTop = container.scrollHeight;
      updateScrollState();
      return;
    }

    isAutoScrolling = true;
    const startScrollTop = container.scrollTop;
    const targetScrollTop = container.scrollHeight - container.clientHeight;
    const distance = targetScrollTop - startScrollTop;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      if (!container || !mounted) return;

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / smoothScrollDuration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const newScrollTop = startScrollTop + (distance * easeOut);
      container.scrollTop = newScrollTop;

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        isAutoScrolling = false;
        updateScrollState();
        
        // Clear new content indicator
        scrollState.update(state => ({
          ...state,
          hasNewContent: false,
        }));
        
        dispatch('newContent', { visible: false });
      }
    };

    animationFrameId = requestAnimationFrame(animate);
  };

  // Handle scroll events
  const handleScroll = () => {
    if (!container || !mounted || isAutoScrolling) return;

    // Detect user scrolling
    if (!isUserScrolling) {
      isUserScrolling = true;
      
      // Determine scroll direction
      const currentScrollTop = container.scrollTop;
      const previousScrollTop = $scrollState.scrollTop;
      const direction = currentScrollTop > previousScrollTop ? 'down' : 'up';
      
      dispatch('userScrollDetected', { direction });
    }

    // Clear user scroll timeout
    if (userScrollTimeout) {
      clearTimeout(userScrollTimeout);
    }

    // Set timeout to detect when user stops scrolling
    userScrollTimeout = setTimeout(() => {
      isUserScrolling = false;
    }, 150);

    updateScrollState();
  };

  // Handle new content detection
  const handleContentChange = () => {
    if (!container || !mounted) return;

    const wasAtBottom = $scrollState.isAtBottom;
    
    // Update scroll state first
    updateScrollState();
    
    if (autoScroll && wasAtBottom && !isUserScrolling) {
      // Auto-scroll to bottom if user was already at bottom
      scrollToBottom(true);
    } else if (!wasAtBottom) {
      // Show new content indicator if user is not at bottom
      scrollState.update(state => ({
        ...state,
        hasNewContent: true,
      }));
      
      dispatch('newContent', { visible: true });
    }
  };

  // Observe container content changes
  let contentObserver: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const setupObservers = () => {
    if (!container) return;

    // Observe content changes
    contentObserver = new MutationObserver(() => {
      requestAnimationFrame(handleContentChange);
    });

    contentObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Observe size changes
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(updateScrollState);
      });

      resizeObserver.observe(container);
    }
  };

  const cleanupObservers = () => {
    if (contentObserver) {
      contentObserver.disconnect();
      contentObserver = null;
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  };

  // Public API
  export const scrollToTop = (smooth = true) => {
    if (!container || !mounted) return;

    if (smooth) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      container.scrollTop = 0;
    }
  };

  export const scrollToElement = (element: Element, smooth = true) => {
    if (!container || !mounted) return;

    if (smooth) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      element.scrollIntoView({ block: 'nearest' });
    }
  };

  export const getScrollState = () => $scrollState;

  // Lifecycle
  onMount(() => {
    mounted = true;
    
    if (container) {
      setupObservers();
      updateScrollState();
      
      // Initial scroll to bottom if auto-scroll is enabled
      if (autoScroll) {
        scrollToBottom(false);
      }
    }
  });

  onDestroy(() => {
    mounted = false;
    
    cleanupObservers();
    
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    
    if (userScrollTimeout) {
      clearTimeout(userScrollTimeout);
    }
  });

  // Handle prop changes
  $: if (container && mounted && autoScroll && $isAtBottom) {
    scrollToBottom(true);
  }
</script>

<div
  bind:this={container}
  class="smooth-scroll-container {className}"
  {style}
  on:scroll={handleScroll}
  role="log"
  aria-live="polite"
  aria-label="Message container with auto-scroll"
>
  <!-- Content slot -->
  <slot />

  <!-- New content indicator -->
  {#if newContentIndicator && $hasNewContent && !$isAtBottom}
    <div 
      class="new-content-indicator"
      role="status"
      aria-live="polite"
      aria-label="New messages available below"
    >
      <div class="indicator-content">
        <span class="indicator-icon">↓</span>
        <span class="indicator-text">New messages</span>
        <span class="indicator-count">{Math.ceil($distanceFromBottom / 50)}</span>
      </div>
    </div>
  {/if}

  <!-- Scroll to bottom button -->
  {#if scrollToBottomButton && !$isAtBottom}
    <button
      class="scroll-to-bottom-btn"
      on:click={() => scrollToBottom(true)}
      aria-label="Scroll to bottom"
      title="Scroll to latest messages"
    >
      <span class="btn-icon">⬇</span>
      {#if $hasNewContent}
        <div class="new-content-badge">
          <span class="badge-text">New</span>
        </div>
      {/if}
    </button>
  {/if}
</div>

<style>
  .smooth-scroll-container {
    position: relative;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
    
    /* Custom scrollbar */
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
  }

  .smooth-scroll-container::-webkit-scrollbar {
    width: 6px;
  }

  .smooth-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .smooth-scroll-container::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
    transition: background 0.2s;
  }

  .smooth-scroll-container::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.4);
  }

  /* New content indicator */
  .new-content-indicator {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    pointer-events: none;
    animation: slideDown 0.3s ease-out;
  }

  .indicator-content {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(59, 130, 246, 0.9);
    color: white;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(8px);
  }

  .indicator-icon {
    font-size: 14px;
    animation: bounce 1s ease-in-out infinite;
  }

  .indicator-count {
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 11px;
    min-width: 18px;
    text-align: center;
  }

  /* Scroll to bottom button */
  .scroll-to-bottom-btn {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.9);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: bold;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
    z-index: 10;
    animation: slideUp 0.3s ease-out;
  }

  .scroll-to-bottom-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    background: rgba(99, 102, 241, 1);
  }

  .scroll-to-bottom-btn:active {
    transform: translateY(0);
  }

  .btn-icon {
    line-height: 1;
  }

  /* New content badge */
  .new-content-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    background: #ef4444;
    border: 2px solid white;
    border-radius: 12px;
    min-width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse 2s ease-in-out infinite;
  }

  .badge-text {
    font-size: 9px;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Animations */
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-4px);
    }
    60% {
      transform: translateY(-2px);
    }
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .smooth-scroll-container::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
    }

    .smooth-scroll-container::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.4);
    }

    .indicator-content {
      background: rgba(79, 70, 229, 0.9);
    }

    .scroll-to-bottom-btn {
      background: rgba(124, 58, 237, 0.9);
    }

    .scroll-to-bottom-btn:hover {
      background: rgba(124, 58, 237, 1);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .smooth-scroll-container {
      scroll-behavior: auto;
    }

    .new-content-indicator {
      animation: none;
    }

    .scroll-to-bottom-btn {
      animation: none;
    }

    .indicator-icon {
      animation: none;
    }

    .new-content-badge {
      animation: none;
    }
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .scroll-to-bottom-btn {
      width: 44px;
      height: 44px;
      bottom: 12px;
      right: 12px;
    }

    .new-content-indicator {
      top: 12px;
    }

    .indicator-content {
      padding: 6px 12px;
      font-size: 12px;
    }

    .indicator-count {
      font-size: 10px;
      min-width: 16px;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .indicator-content {
      border: 2px solid currentColor;
    }

    .scroll-to-bottom-btn {
      border: 2px solid currentColor;
    }
  }
</style> 