<script lang="ts">
  export let variant: 'user' | 'assistant' = 'assistant';
  export let showAvatar = true;
  export let lines = 2;
</script>

<div class="message-skeleton message-skeleton-{variant}">
  {#if showAvatar && variant === 'assistant'}
    <div class="avatar-skeleton skeleton-shimmer"></div>
  {/if}
  
  <div class="content-skeleton">
    <div class="header-skeleton">
      <div class="name-skeleton skeleton-shimmer"></div>
      <div class="time-skeleton skeleton-shimmer"></div>
    </div>
    
    <div class="text-skeleton">
      {#each Array(lines) as _, i}
        <div 
          class="line-skeleton skeleton-shimmer" 
          class:last-line={i === lines - 1}
        ></div>
      {/each}
    </div>
  </div>
</div>

<style>
  .message-skeleton {
    display: flex;
    gap: 12px;
    padding: 16px;
    margin-bottom: 8px;
    opacity: 0.6;
  }
  
  .message-skeleton-user {
    flex-direction: row-reverse;
    justify-content: flex-start;
  }
  
  .avatar-skeleton {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  
  .content-skeleton {
    flex: 1;
    max-width: 70%;
  }
  
  .message-skeleton-user .content-skeleton {
    max-width: 80%;
  }
  
  .header-skeleton {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
  
  .name-skeleton {
    width: 80px;
    height: 14px;
    border-radius: 4px;
  }
  
  .time-skeleton {
    width: 40px;
    height: 12px;
    border-radius: 4px;
  }
  
  .text-skeleton {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .line-skeleton {
    height: 16px;
    border-radius: 8px;
    width: 100%;
  }
  
  .line-skeleton.last-line {
    width: 75%; /* Make last line shorter for natural look */
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
    .message-skeleton {
      padding: 12px 8px;
    }
    
    .content-skeleton {
      max-width: 85%;
    }
    
    .avatar-skeleton {
      width: 28px;
      height: 28px;
    }
    
    .name-skeleton {
      width: 60px;
      height: 12px;
    }
    
    .time-skeleton {
      width: 32px;
      height: 10px;
    }
    
    .line-skeleton {
      height: 14px;
    }
  }
</style> 