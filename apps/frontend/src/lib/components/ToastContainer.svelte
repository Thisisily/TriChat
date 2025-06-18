<script lang="ts">
  import { writable } from 'svelte/store';
  import { onMount } from 'svelte';
  import ToastNotification from './ToastNotification.svelte';
  
  interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    duration?: number;
    dismissible?: boolean;
    persistent?: boolean;
  }
  
  export let maxToasts = 5;
  export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center' = 'top-right';
  
  let toasts = writable<Toast[]>([]);
  let toastElements = new Map<string, ToastNotification>();
  
  function generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
  
  export function addToast(toast: Omit<Toast, 'id'>) {
    const id = generateId();
    const newToast: Toast = {
      id,
      duration: 5000,
      dismissible: true,
      persistent: false,
      ...toast
    };
    
    toasts.update(currentToasts => {
      const updated = [newToast, ...currentToasts];
      // Remove oldest toasts if we exceed maxToasts
      if (updated.length > maxToasts) {
        return updated.slice(0, maxToasts);
      }
      return updated;
    });
    
    return id;
  }
  
  export function removeToast(id: string) {
    toasts.update(currentToasts => 
      currentToasts.filter(toast => toast.id !== id)
    );
  }
  
  export function clearAllToasts() {
    toasts.set([]);
  }
  
  // Convenience methods
  export function showSuccess(message: string, title?: string, options?: Partial<Toast>) {
    return addToast({ type: 'success', message, title, ...options });
  }
  
  export function showError(message: string, title?: string, options?: Partial<Toast>) {
    return addToast({ type: 'error', message, title, persistent: true, ...options });
  }
  
  export function showWarning(message: string, title?: string, options?: Partial<Toast>) {
    return addToast({ type: 'warning', message, title, ...options });
  }
  
  export function showInfo(message: string, title?: string, options?: Partial<Toast>) {
    return addToast({ type: 'info', message, title, ...options });
  }
  
  function handleToastDismiss(id: string) {
    removeToast(id);
  }
  
  // Global toast functions
  if (typeof window !== 'undefined') {
    // @ts-ignore - Adding global toast functions
    window.toast = {
      success: showSuccess,
      error: showError,
      warning: showWarning,
      info: showInfo,
      clear: clearAllToasts
    };
  }
</script>

<div class="toast-container toast-position-{position}">
  {#each $toasts as toast (toast.id)}
    <ToastNotification
      type={toast.type}
      title={toast.title || ''}
      message={toast.message}
      duration={toast.duration || 5000}
      dismissible={toast.dismissible}
      persistent={toast.persistent}
      on:dismiss={() => handleToastDismiss(toast.id)}
    />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .toast-container > :global(*) {
    pointer-events: auto;
  }
  
  /* Position variants */
  .toast-position-top-right {
    top: 20px;
    right: 20px;
  }
  
  .toast-position-top-left {
    top: 20px;
    left: 20px;
  }
  
  .toast-position-bottom-right {
    bottom: 20px;
    right: 20px;
    flex-direction: column-reverse;
  }
  
  .toast-position-bottom-left {
    bottom: 20px;
    left: 20px;
    flex-direction: column-reverse;
  }
  
  .toast-position-top-center {
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .toast-position-bottom-center {
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    flex-direction: column-reverse;
  }
  
  /* Mobile adjustments */
  @media (max-width: 768px) {
    .toast-position-top-right,
    .toast-position-top-left {
      top: 16px;
      left: 16px;
      right: 16px;
    }
    
    .toast-position-bottom-right,
    .toast-position-bottom-left {
      bottom: 16px;
      left: 16px;
      right: 16px;
    }
    
    .toast-position-top-center {
      top: 16px;
      left: 16px;
      right: 16px;
      transform: none;
    }
    
    .toast-position-bottom-center {
      bottom: 16px;
      left: 16px;
      right: 16px;
      transform: none;
    }
    
    /* Ensure toasts don't interfere with safe areas */
    .toast-position-top-right,
    .toast-position-top-left,
    .toast-position-top-center {
      top: max(16px, env(safe-area-inset-top));
      padding-top: env(safe-area-inset-top);
    }
    
    .toast-position-bottom-right,
    .toast-position-bottom-left,
    .toast-position-bottom-center {
      bottom: max(16px, env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
    }
  }
  
  /* Small mobile devices */
  @media (max-width: 480px) {
    .toast-position-top-right,
    .toast-position-top-left,
    .toast-position-bottom-right,
    .toast-position-bottom-left,
    .toast-position-top-center,
    .toast-position-bottom-center {
      left: 8px;
      right: 8px;
    }
    
    .toast-position-top-right,
    .toast-position-top-left,
    .toast-position-top-center {
      top: max(8px, env(safe-area-inset-top));
    }
    
    .toast-position-bottom-right,
    .toast-position-bottom-left,
    .toast-position-bottom-center {
      bottom: max(8px, env(safe-area-inset-bottom));
    }
  }
</style> 