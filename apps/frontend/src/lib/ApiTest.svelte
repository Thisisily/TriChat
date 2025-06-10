<script lang="ts">
  import { trpc } from './trpc';

  let healthData: any = null;
  let modelsData: any = null;
  let loading = false;
  let error: string | null = null;

  // Test health check
  async function testHealthCheck() {
    try {
      loading = true;
      error = null;
      
      // This demonstrates full type safety - IDE will autocomplete and type check
      healthData = await trpc.health.check.query();
      console.log('Health check result:', healthData);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Health check failed:', err);
    } finally {
      loading = false;
    }
  }

  // Test models endpoint
  async function testModels() {
    try {
      loading = true;
      error = null;
      
      // Another example of type-safe API call
      modelsData = await trpc.chat.models.query();
      console.log('Models result:', modelsData);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Models test failed:', err);
    } finally {
      loading = false;
    }
  }

  // Test ping with input
  async function testPing() {
    try {
      loading = true;
      error = null;
      
      // Example with input parameters - fully type-safe
      const result = await trpc.health.ping.query({ 
        message: 'Hello from Svelte frontend!' 
      });
      console.log('Ping result:', result);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error('Ping test failed:', err);
    } finally {
      loading = false;
    }
  }
</script>

<div class="api-test">
  <h2>🔗 tRPC API Test</h2>
  <p>Testing end-to-end type safety between Svelte frontend and Bun backend</p>
  
  <div class="buttons">
    <button on:click={testHealthCheck} disabled={loading}>
      Test Health Check
    </button>
    
    <button on:click={testModels} disabled={loading}>
      Test Models
    </button>
    
    <button on:click={testPing} disabled={loading}>
      Test Ping
    </button>
  </div>

  {#if loading}
    <p class="loading">⏳ Loading...</p>
  {/if}

  {#if error}
    <p class="error">❌ Error: {error}</p>
  {/if}

  {#if healthData}
    <div class="result">
      <h3>Health Check Result:</h3>
      <pre>{JSON.stringify(healthData, null, 2)}</pre>
    </div>
  {/if}

  {#if modelsData}
    <div class="result">
      <h3>Available Models:</h3>
      <pre>{JSON.stringify(modelsData, null, 2)}</pre>
    </div>
  {/if}
</div>

<style>
  .api-test {
    padding: 20px;
    max-width: 600px;
    margin: 0 auto;
  }

  .buttons {
    display: flex;
    gap: 10px;
    margin: 20px 0;
    flex-wrap: wrap;
  }

  button {
    padding: 10px 20px;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
  }

  button:hover:not(:disabled) {
    background: #4338ca;
  }

  button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .loading {
    color: #f59e0b;
    font-weight: bold;
  }

  .error {
    color: #ef4444;
    font-weight: bold;
  }

  .result {
    margin-top: 20px;
    padding: 15px;
    background: #f3f4f6;
    border-radius: 5px;
  }

  .result h3 {
    margin-top: 0;
    color: #059669;
  }

  pre {
    background: #1f2937;
    color: #e5e7eb;
    padding: 10px;
    border-radius: 5px;
    overflow-x: auto;
    font-size: 12px;
  }
</style> 