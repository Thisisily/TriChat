<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    initializeClerk, 
    themeActions,
  } from './lib/stores';
  import ChatUI from './lib/components/ChatUI.svelte';
  import LiquidGlassFilters from './lib/components/LiquidGlassFilters.svelte';
  import AnimatedBackground from './lib/components/AnimatedBackground.svelte';
  import ToastContainer from './lib/components/ToastContainer.svelte';
  import ErrorBoundary from './lib/components/ErrorBoundary.svelte';
  import './lib/styles/liquid-glass.css';

  // Initialize Clerk and theme on app startup
  onMount(async () => {
    await initializeClerk();
    themeActions.initializeTheme();
  });
</script>

<LiquidGlassFilters />
<AnimatedBackground />

<main class="app liquid-glass-bg">
  <ErrorBoundary>
    <ChatUI />
  </ErrorBoundary>
</main>

<!-- Global Toast Container -->
<ToastContainer position="top-right" />

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
  
  :global(html, body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
  }
  
  .app {
    width: 100%;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }

  .liquid-glass-bg {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .liquid-glass-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 40% 20%, rgba(255, 219, 98, 0.2) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }
  
  /* Dark mode support */
  :global(.dark) {
    color-scheme: dark;
  }

  :global(.dark .liquid-glass-bg) {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  }
  
  :global(.light) {
    color-scheme: light;
  }
</style>
