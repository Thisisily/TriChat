<script lang="ts">
  export let count = 3;
</script>

<div class="thread-skeleton-container">
  {#each Array(count) as _, i}
    <div class="thread-skeleton">
      <div class="thread-icon-skeleton skeleton-shimmer"></div>
      <div class="thread-content-skeleton">
        <div class="thread-title-skeleton skeleton-shimmer"></div>
        <div class="thread-preview-skeleton skeleton-shimmer"></div>
        <div class="thread-time-skeleton skeleton-shimmer"></div>
      </div>
    </div>
  {/each}
</div>

<style>
  .thread-skeleton-container {
    padding: 8px 0;
  }
  
  .thread-skeleton {
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    margin-bottom: 4px;
    border-radius: 12px;
    opacity: 0.6;
  }
  
  .thread-icon-skeleton {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    flex-shrink: 0;
    margin-top: 2px;
  }
  
  .thread-content-skeleton {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  
  .thread-title-skeleton {
    width: 85%;
    height: 16px;
    border-radius: 8px;
  }
  
  .thread-preview-skeleton {
    width: 70%;
    height: 14px;
    border-radius: 7px;
  }
  
  .thread-time-skeleton {
    width: 50px;
    height: 12px;
    border-radius: 6px;
    margin-top: 2px;
  }
  
  /* Shimmer animation */
  .skeleton-shimmer {
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.06) 0%,
      rgba(0, 0, 0, 0.12) 50%,
      rgba(0, 0, 0, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }
  
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  
  /* Stagger animation for multiple skeletons */
  .thread-skeleton:nth-child(1) .skeleton-shimmer {
    animation-delay: 0s;
  }
  
  .thread-skeleton:nth-child(2) .skeleton-shimmer {
    animation-delay: 0.1s;
  }
  
  .thread-skeleton:nth-child(3) .skeleton-shimmer {
    animation-delay: 0.2s;
  }
  
  .thread-skeleton:nth-child(4) .skeleton-shimmer {
    animation-delay: 0.3s;
  }
  
  .thread-skeleton:nth-child(5) .skeleton-shimmer {
    animation-delay: 0.4s;
  }
  
  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .skeleton-shimmer {
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.05) 0%,
        rgba(255, 255, 255, 0.1) 50%,
        rgba(255, 255, 255, 0.05) 100%
      );
      background-size: 200% 100%;
    }
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .thread-skeleton {
      padding: 10px 12px;
      gap: 10px;
    }
    
    .thread-icon-skeleton {
      width: 20px;
      height: 20px;
    }
    
    .thread-title-skeleton {
      height: 14px;
      width: 80%;
    }
    
    .thread-preview-skeleton {
      height: 12px;
      width: 65%;
    }
    
    .thread-time-skeleton {
      height: 10px;
      width: 40px;
    }
  }
</style> 