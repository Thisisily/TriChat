<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher<{
    navigate: { direction: 'up' | 'down' | 'left' | 'right' | 'enter' | 'escape' };
    focus: { element: HTMLElement };
  }>();
  
  export let enabled = true;
  export let trapFocus = false;
  export let autoFocus = false;
  export let focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  export let className = '';
  
  let container: HTMLElement;
  let focusableElements: HTMLElement[] = [];
  let currentFocusIndex = -1;
  
  // Get all focusable elements within the container
  function updateFocusableElements() {
    if (!container) return;
    
    const elements = Array.from(
      container.querySelectorAll(focusableSelector)
    ) as HTMLElement[];
    
    focusableElements = elements.filter(el => {
      // Check if element is visible and not disabled
      const style = window.getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !el.hasAttribute('disabled') &&
        el.tabIndex !== -1
      );
    });
  }
  
  // Focus management
  function focusElement(index: number) {
    if (index < 0 || index >= focusableElements.length) return;
    
    const element = focusableElements[index];
    element.focus();
    currentFocusIndex = index;
    dispatch('focus', { element });
  }
  
  function focusFirst() {
    focusElement(0);
  }
  
  function focusLast() {
    focusElement(focusableElements.length - 1);
  }
  
  function focusNext() {
    if (currentFocusIndex < focusableElements.length - 1) {
      focusElement(currentFocusIndex + 1);
    } else if (trapFocus) {
      focusFirst();
    }
  }
  
  function focusPrevious() {
    if (currentFocusIndex > 0) {
      focusElement(currentFocusIndex - 1);
    } else if (trapFocus) {
      focusLast();
    }
  }
  
  // Keyboard event handling
  function handleKeyDown(event: KeyboardEvent) {
    if (!enabled) return;
    
    updateFocusableElements();
    
    // Update current focus index
    const activeElement = document.activeElement as HTMLElement;
    currentFocusIndex = focusableElements.indexOf(activeElement);
    
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        focusPrevious();
        dispatch('navigate', { direction: 'up' });
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        focusNext();
        dispatch('navigate', { direction: 'down' });
        break;
        
      case 'ArrowLeft':
        event.preventDefault();
        dispatch('navigate', { direction: 'left' });
        break;
        
      case 'ArrowRight':
        event.preventDefault();
        dispatch('navigate', { direction: 'right' });
        break;
        
      case 'Home':
        event.preventDefault();
        focusFirst();
        break;
        
      case 'End':
        event.preventDefault();
        focusLast();
        break;
        
      case 'Enter':
      case ' ':
        // Let the focused element handle enter/space
        dispatch('navigate', { direction: 'enter' });
        break;
        
      case 'Escape':
        event.preventDefault();
        dispatch('navigate', { direction: 'escape' });
        break;
        
      case 'Tab':
        if (trapFocus) {
          event.preventDefault();
          if (event.shiftKey) {
            focusPrevious();
          } else {
            focusNext();
          }
        }
        break;
    }
  }
  
  // Focus trap handling
  function handleFocusIn(event: FocusEvent) {
    if (!trapFocus || !enabled) return;
    
    const target = event.target as HTMLElement;
    if (!container.contains(target)) {
      // Focus escaped the container, bring it back
      event.preventDefault();
      focusFirst();
    }
  }
  
  // Auto-focus on mount
  onMount(() => {
    updateFocusableElements();
    
    if (autoFocus && focusableElements.length > 0) {
      setTimeout(focusFirst, 100);
    }
    
    // Add global focus trap listener if needed
    if (trapFocus) {
      document.addEventListener('focusin', handleFocusIn);
    }
    
    return () => {
      if (trapFocus) {
        document.removeEventListener('focusin', handleFocusIn);
      }
    };
  });
  
  // Public methods for external control
  export function focus() {
    if (focusableElements.length > 0) {
      focusFirst();
    }
  }
  
  export function updateFocusable() {
    updateFocusableElements();
  }
  
  export function getCurrentFocusIndex() {
    return currentFocusIndex;
  }
  
  export function getFocusableElements() {
    return focusableElements;
  }
</script>

<div 
  bind:this={container}
  class="keyboard-navigation {className}"
  on:keydown={handleKeyDown}
  role="group"
  aria-label="Keyboard navigable area"
>
  <slot></slot>
</div>

<style>
  .keyboard-navigation {
    outline: none;
  }
  
  .keyboard-navigation:focus-visible {
    outline: 2px solid var(--focus-color, #667eea);
    outline-offset: 2px;
  }
  
  /* Enhanced focus styles for child elements */
  .keyboard-navigation :global(*:focus-visible) {
    outline: 2px solid var(--focus-color, #667eea);
    outline-offset: 2px;
    border-radius: 4px;
  }
  
  /* Remove default focus styles for better control */
  .keyboard-navigation :global(*:focus) {
    outline: none;
  }
  
  /* Ensure focusable elements are visible */
  .keyboard-navigation :global([tabindex]:not([tabindex="-1"])) {
    position: relative;
  }
  
  /* Screen reader only helper text */
  .keyboard-navigation::before {
    content: "Use arrow keys to navigate, Enter to activate, Escape to close";
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
</style> 