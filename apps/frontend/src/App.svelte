<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeClerk, isLoading, isAuthenticated } from './lib/stores/auth';
  import { trpc } from './lib/trpc';
  import AuthButton from './lib/components/AuthButton.svelte';

  let healthData: any = null;
  let authUserData: any = null;
  let error: string | null = null;
  let loading = false;

  // Initialize Clerk on app startup
  onMount(async () => {
    await initializeClerk();
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
</script>

<main>
  <div class="container">
    <!-- Header with Authentication -->
    <header class="header">
      <h1>🔥 TriChat</h1>
      {#if $isLoading}
        <div class="loading">Loading...</div>
      {:else}
        <AuthButton />
      {/if}
    </header>

    <!-- Main Content -->
    <section class="content">
      <h2>Multi-LLM Chat Application</h2>
      <p>Built with Svelte + Hono + tRPC + Clerk Authentication</p>

      <!-- Test Buttons -->
      <div class="test-section">
        <h3>API Tests</h3>
        
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

      <!-- Authentication Status -->
      <div class="auth-status">
        <h3>Authentication Status</h3>
        {#if $isLoading}
          <p>🔄 Loading authentication...</p>
        {:else if $isAuthenticated}
          <p>✅ Signed in and authenticated</p>
        {:else}
          <p>❌ Not signed in</p>
        {/if}
      </div>
    </section>
  </div>
</main>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 0;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 32px;
  }

  .header h1 {
    margin: 0;
    color: #1f2937;
    font-size: 2rem;
  }

  .loading {
    color: #6b7280;
    font-style: italic;
  }

  .content {
    max-width: 800px;
  }

  .content h2 {
    color: #1f2937;
    margin-bottom: 8px;
  }

  .content p {
    color: #6b7280;
    margin-bottom: 32px;
  }

  .test-section {
    background: #f9fafb;
    padding: 24px;
    border-radius: 8px;
    margin-bottom: 32px;
  }

  .test-section h3 {
    margin: 0 0 16px 0;
    color: #374151;
  }

  .button-group {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .btn {
    padding: 10px 20px;
    border-radius: 6px;
    border: 1px solid;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    background: none;
    font-size: 14px;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #2563eb;
    color: white;
    border-color: #2563eb;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
    border-color: #1d4ed8;
  }

  .btn-secondary {
    background: #10b981;
    color: white;
    border-color: #10b981;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #059669;
    border-color: #059669;
  }

  .error {
    background: #fef2f2;
    color: #dc2626;
    padding: 12px;
    border-radius: 6px;
    border: 1px solid #fecaca;
    margin-bottom: 16px;
  }

  .result {
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .result h4 {
    margin: 0 0 12px 0;
    color: #374151;
  }

  .result pre {
    background: #f3f4f6;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 13px;
    margin: 0;
  }

  .auth-status {
    background: #f0f9ff;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #bae6fd;
  }

  .auth-status h3 {
    margin: 0 0 12px 0;
    color: #0c4a6e;
  }

  .auth-status p {
    margin: 0;
    color: #0369a1;
    font-weight: 500;
  }
</style>
