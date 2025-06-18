<script lang="ts">
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let variant: 'primary' | 'secondary' | 'glass' = 'primary';
  export let className = '';
  
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6', 
    large: 'w-8 h-8'
  };
</script>

<div class="spinner-container {className}">
  <div 
    class="spinner spinner-{variant} {sizeClasses[size]}"
    role="status"
    aria-label="Loading"
  >
    <span class="sr-only">Loading...</span>
  </div>
</div>

<style>
  .spinner-container {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  
  .spinner {
    border-radius: 50%;
    animation: spin 1s linear infinite;
    border-style: solid;
    border-width: 2px;
  }
  
  .spinner-primary {
    border-color: rgba(102, 126, 234, 0.3);
    border-top-color: rgb(102, 126, 234);
  }
  
  .spinner-secondary {
    border-color: rgba(156, 163, 175, 0.3);
    border-top-color: rgb(156, 163, 175);
  }
  
  .spinner-glass {
    border-color: rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(4px);
  }
  
  /* Size utilities */
  .w-4 { width: 1rem; }
  .h-4 { height: 1rem; }
  .w-6 { width: 1.5rem; }
  .h-6 { height: 1.5rem; }
  .w-8 { width: 2rem; }
  .h-8 { height: 2rem; }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
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
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .spinner-primary {
      border-color: rgba(139, 69, 199, 0.3);
      border-top-color: rgb(139, 69, 199);
    }
    
    .spinner-secondary {
      border-color: rgba(209, 213, 219, 0.3);
      border-top-color: rgb(209, 213, 219);
    }
  }
</style> 