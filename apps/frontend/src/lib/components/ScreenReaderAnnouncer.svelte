<script lang="ts">
  import { onMount } from 'svelte';
  
  export let message = '';
  export let priority: 'polite' | 'assertive' = 'polite';
  export let clearAfter = 1000; // Clear message after this time (ms)
  
  let announcer: HTMLElement;
  let clearTimeoutId: ReturnType<typeof setTimeout>;
  
  // Announce a message
  export function announce(text: string, urgent = false) {
    if (!announcer) return;
    
    // Clear any existing timeout
    if (clearTimeoutId) {
      clearTimeout(clearTimeoutId);
    }
    
    // Set the aria-live priority
    const ariaLive = urgent ? 'assertive' : 'polite';
    announcer.setAttribute('aria-live', ariaLive);
    
    // Set the message
    announcer.textContent = text;
    
    // Clear the message after a delay
    clearTimeoutId = setTimeout(() => {
      if (announcer) {
        announcer.textContent = '';
      }
    }, clearAfter);
  }
  
  // Clear current announcement
  export function clear() {
    if (announcer) {
      announcer.textContent = '';
    }
    if (clearTimeoutId) {
      clearTimeout(clearTimeoutId);
    }
  }
  
  // Watch for message prop changes
  $: if (message && announcer) {
    announce(message, priority === 'assertive');
  }
  
  onMount(() => {
    return () => {
      if (clearTimeoutId) {
        clearTimeout(clearTimeoutId);
      }
    };
  });
</script>

<!-- Screen reader only announcer -->
<div
  bind:this={announcer}
  aria-live={priority}
  aria-atomic="true"
  class="sr-only"
  role="status"
  aria-label="Screen reader announcements"
>
  {message}
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style> 