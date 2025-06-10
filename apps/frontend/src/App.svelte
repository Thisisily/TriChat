<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    initializeClerk, 
    isLoading as authLoading, 
    isAuthenticated,
    threads,
    sortedThreads,
    currentThread,
    threadActions,
    messageActions,
    preferences,
    uiActions,
    themeActions,
    type Thread
  } from './lib/stores';
  import { trpc } from './lib/trpc';
  import AuthButton from './lib/components/AuthButton.svelte';

  let healthData: any = null;
  let authUserData: any = null;
  let error: string | null = null;
  let loading = false;
  let newThreadTitle = '';

  // Initialize Clerk and theme on app startup
  onMount(async () => {
    await initializeClerk();
    themeActions.initializeTheme();
  });

  async function testHealthCheck() {
    loading = true;
    error = null;
    try {
      healthData = await trpc.health.check.query();
      console.log('Health check:', healthData);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Health check failed';
      console.error('Health check error:', err);
    } finally {
      loading = false;
    }
  }

  async function testAuthEndpoint() {
    loading = true;
    error = null;
    try {
      authUserData = await trpc.auth.me.query();
      console.log('Auth user data:', authUserData);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Auth request failed';
      console.error('Auth error:', err);
    } finally {
      loading = false;
    }
  }

  async function createNewThread() {
    if (!newThreadTitle.trim()) return;
    
    try {
      error = null;
      const thread = await threadActions.createThread(newThreadTitle);
      newThreadTitle = '';
      console.log('Created thread:', thread);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create thread';
    }
  }

  async function selectThread(thread: Thread) {
    try {
      error = null;
      await threadActions.selectThread(thread);
      console.log('Selected thread:', thread);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to select thread';
    }
  }

  async function sendTestMessage() {
    try {
      error = null;
      await messageActions.sendMessage(
        'Hello from the store system!',
        $preferences.defaultModel,
        $preferences.defaultProvider
      );
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send message';
    }
  }

  function toggleTheme() {
    const currentTheme = $preferences.theme;
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    themeActions.setTheme(newTheme);
  }
</script>

<main class="app">
  <div class="container">
    <!-- Header with Authentication and Theme Toggle -->
    <header class="header">
      <div class="header-left">
        <h1>🔥 TriChat</h1>
        <span class="version">v2.0 - Store System</span>
      </div>
      
      <div class="header-right">
        <button class="btn btn-ghost" on:click={toggleTheme}>
          {$preferences.theme === 'dark' ? '☀️' : '🌙'}
        </button>
        
        <button class="btn btn-ghost" on:click={uiActions.toggleSidebar}>
          {$preferences.showSidebar ? '→' : '←'}
        </button>
        
        {#if $authLoading}
          <div class="loading">Loading...</div>
        {:else}
          <AuthButton />
        {/if}
      </div>
    </header>

    <!-- Main Content Area -->
    <div class="main-content" class:with-sidebar={$preferences.showSidebar}>
      
      <!-- Sidebar -->
      {#if $preferences.showSidebar}
        <aside class="sidebar">
          <div class="sidebar-section">
            <h3>🧵 Threads ({$threads.length})</h3>
            
            {#if $isAuthenticated}
              <div class="new-thread">
                <input 
                  bind:value={newThreadTitle} 
                  placeholder="New thread title..."
                  class="input"
                  on:keydown={(e) => e.key === 'Enter' && createNewThread()}
                />
                <button 
                  class="btn btn-primary btn-sm" 
                  on:click={createNewThread}
                  disabled={!newThreadTitle.trim()}
                >
                  Create
                </button>
              </div>
              
              <div class="thread-list">
                {#each $sortedThreads as thread (thread.id)}
                  <button 
                    class="thread-item"
                    class:active={$currentThread?.id === thread.id}
                    on:click={() => selectThread(thread)}
                  >
                    <div class="thread-title">{thread.title}</div>
                    <div class="thread-meta">
                      {new Date(thread.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                {/each}
              </div>
            {:else}
              <p class="auth-prompt">Sign in to view threads</p>
            {/if}
          </div>
        </aside>
      {/if}

      <!-- Content Area -->
      <section class="content">
        <h2>Multi-LLM Chat with Global State</h2>
        <p>Enhanced with Svelte stores, authentication, and persistence</p>

        <!-- Current Thread Display -->
        {#if $currentThread}
          <div class="current-thread">
            <h3>📝 Current Thread: {$currentThread.title}</h3>
            <button class="btn btn-secondary" on:click={sendTestMessage}>
              Send Test Message
            </button>
            <button class="btn btn-outline" on:click={() => threadActions.clearThread()}>
              Clear Selection
            </button>
          </div>
        {/if}

        <!-- Test Buttons -->
        <div class="test-section">
          <h3>API & Store Tests</h3>
          
          <div class="button-group">
            <button 
              class="btn btn-primary" 
              on:click={testHealthCheck}
              disabled={loading}
            >
              {loading ? 'Testing...' : 'Test Health Check'}
            </button>

            {#if $isAuthenticated}
              <button 
                class="btn btn-secondary" 
                on:click={testAuthEndpoint}
                disabled={loading}
              >
                {loading ? 'Testing...' : 'Test Auth Endpoint'}
              </button>
            {/if}

            <button 
              class="btn btn-ghost" 
              on:click={uiActions.resetPreferences}
            >
              Reset Preferences
            </button>
          </div>

          {#if error}
            <div class="error">
              <strong>Error:</strong> {error}
            </div>
          {/if}

          {#if healthData}
            <div class="result">
              <h4>Health Check Result:</h4>
              <pre>{JSON.stringify(healthData, null, 2)}</pre>
            </div>
          {/if}

          {#if authUserData}
            <div class="result">
              <h4>Auth User Data:</h4>
              <pre>{JSON.stringify(authUserData, null, 2)}</pre>
            </div>
          {/if}
        </div>

        <!-- Store State Display -->
        <div class="store-state">
          <h3>🏪 Current Store State</h3>
          <div class="state-grid">
            <div class="state-item">
              <h4>Preferences</h4>
              <pre>{JSON.stringify($preferences, null, 2)}</pre>
            </div>
            <div class="state-item">
              <h4>Threads ({$threads.length})</h4>
              <pre>{JSON.stringify($threads.slice(0, 2), null, 2)}</pre>
            </div>
          </div>
        </div>

        <!-- Authentication Status -->
        <div class="auth-status">
          <h3>🔐 Authentication Status</h3>
          {#if $authLoading}
            <p>🔄 Loading authentication...</p>
          {:else if $isAuthenticated}
            <p>✅ Signed in and authenticated</p>
          {:else}
            <p>❌ Not signed in</p>
          {/if}
        </div>
      </section>
    </div>
  </div>
</main>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: background 0.2s ease, color 0.2s ease;
  }

  /* CSS Variables for theming */
  :global(:root) {
    --bg-primary: #ffffff;
    --bg-secondary: #f9fafb;
    --bg-tertiary: #f3f4f6;
    --text-primary: #1f2937;
    --text-secondary: #6b7280;
    --border: #e5e7eb;
    --primary: #2563eb;
    --primary-hover: #1d4ed8;
    --success: #10b981;
    --success-hover: #059669;
    --error: #ef4444;
    --error-bg: #fef2f2;
  }

  :global(.dark) {
    --bg-primary: #111827;
    --bg-secondary: #1f2937;
    --bg-tertiary: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #d1d5db;
    --border: #374151;
    --primary: #3b82f6;
    --primary-hover: #2563eb;
    --success: #10b981;
    --success-hover: #059669;
    --error: #f87171;
    --error-bg: #1f1f1f;
  }

  .app {
    min-height: 100vh;
    background: var(--bg-primary);
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-left h1 {
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .version {
    background: var(--primary);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .sidebar {
    width: 300px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    flex-shrink: 0;
  }

  .sidebar-section {
    padding: 1rem;
  }

  .sidebar-section h3 {
    margin-bottom: 1rem;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .new-thread {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .thread-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .thread-item {
    display: block;
    width: 100%;
    padding: 0.75rem;
    text-align: left;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .thread-item:hover {
    background: var(--bg-tertiary);
  }

  .thread-item.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .thread-title {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .thread-meta {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .auth-prompt {
    color: var(--text-secondary);
    font-style: italic;
    text-align: center;
    padding: 2rem 1rem;
  }

  .content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .content h2 {
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .content p {
    color: var(--text-secondary);
    margin-bottom: 2rem;
  }

  .current-thread {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 2rem;
    border: 1px solid var(--border);
  }

  .current-thread h3 {
    margin-bottom: 1rem;
    color: var(--text-primary);
  }

  .test-section, .store-state, .auth-status {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 2rem;
    border: 1px solid var(--border);
  }

  .test-section h3, .store-state h3, .auth-status h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .button-group {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    border: 1px solid;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    background: none;
    font-size: 0.875rem;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  .btn-secondary {
    background: var(--success);
    color: white;
    border-color: var(--success);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--success-hover);
    border-color: var(--success-hover);
  }

  .btn-outline {
    color: var(--text-primary);
    border-color: var(--border);
    background: var(--bg-primary);
  }

  .btn-outline:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }

  .btn-ghost {
    color: var(--text-secondary);
    border: none;
    background: transparent;
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .error {
    background: var(--error-bg);
    color: var(--error);
    padding: 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid var(--error);
    margin-bottom: 1rem;
  }

  .result {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .result h4 {
    margin: 0 0 0.75rem 0;
    color: var(--text-primary);
  }

  .result pre {
    background: var(--bg-tertiary);
    padding: 0.75rem;
    border-radius: 0.25rem;
    overflow-x: auto;
    font-size: 0.8125rem;
    margin: 0;
    color: var(--text-primary);
  }

  .state-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .state-item h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .state-item pre {
    background: var(--bg-primary);
    padding: 0.75rem;
    border-radius: 0.25rem;
    border: 1px solid var(--border);
    overflow-x: auto;
    font-size: 0.75rem;
    margin: 0;
    color: var(--text-primary);
    max-height: 200px;
    overflow-y: auto;
  }

  .auth-status p {
    margin: 0;
    font-weight: 500;
    color: var(--text-primary);
  }

  .loading {
    color: var(--text-secondary);
    font-style: italic;
  }

  @media (max-width: 768px) {
    .main-content.with-sidebar {
      flex-direction: column;
    }
    
    .sidebar {
      width: 100%;
      height: 200px;
    }
    
    .state-grid {
      grid-template-columns: 1fr;
    }
    
    .button-group {
      flex-direction: column;
    }
  }
</style>
