<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher<{
    swipeLeft: void;
    swipeRight: void;
    swipeUp: void;
    swipeDown: void;
  }>();
  
  export let threshold = 50; // Minimum distance for a swipe
  export let restraint = 100; // Maximum perpendicular distance
  export let allowedTime = 300; // Maximum time allowed for a swipe
  export let disabled = false;
  
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  
  function handleTouchStart(e: TouchEvent) {
    if (disabled || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
  }
  
  function handleTouchEnd(e: TouchEvent) {
    if (disabled || e.changedTouches.length !== 1) return;
    
    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    const endTime = Date.now();
    
    const distX = endX - startX;
    const distY = endY - startY;
    const elapsedTime = endTime - startTime;
    
    // Check if within allowed time
    if (elapsedTime > allowedTime) return;
    
    // Check for horizontal swipe
    if (Math.abs(distX) >= threshold && Math.abs(distY) <= restraint) {
      if (distX < 0) {
        dispatch('swipeLeft');
      } else {
        dispatch('swipeRight');
      }
    }
    // Check for vertical swipe
    else if (Math.abs(distY) >= threshold && Math.abs(distX) <= restraint) {
      if (distY < 0) {
        dispatch('swipeUp');
      } else {
        dispatch('swipeDown');
      }
    }
  }
  
  function handleTouchMove(e: TouchEvent) {
    // Prevent default scroll behavior during potential swipe
    if (!disabled) {
      e.preventDefault();
    }
  }
</script>

<div 
  class="swipe-container"
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
  on:touchmove={handleTouchMove}
  role="none"
>
  <slot></slot>
</div>

<style>
  .swipe-container {
    width: 100%;
    height: 100%;
    touch-action: none; /* Prevent default touch behaviors */
  }
</style> 