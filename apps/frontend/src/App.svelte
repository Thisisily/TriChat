<script lang="ts">
  import svelteLogo from './assets/svelte.svg';
  import viteLogo from '/vite.svg';
  import Counter from './lib/Counter.svelte';
  import ApiTest from './lib/ApiTest.svelte';
</script>

<main>
  <div>
    <a href="https://vitejs.dev" target="_blank" rel="noreferrer">
      <img src={viteLogo} class="logo" alt="Vite Logo" />
    </a>
    <a href="https://svelte.dev" target="_blank" rel="noreferrer">
      <img src={svelteLogo} class="logo svelte" alt="Svelte Logo" />
    </a>
  </div>
  
  <h1>🗨️ TriChat</h1>
  <h2>Multi-LLM Chat Application</h2>
  
  <p class="subtitle">
    Built with <strong>Bun + Hono + tRPC</strong> backend and <strong>Vite + Svelte</strong> frontend
  </p>

  <div class="card">
    <Counter />
  </div>

  <div class="card">
    <ApiTest />
  </div>

  <p class="read-the-docs">
    Check the console for tRPC API responses demonstrating end-to-end type safety!
  </p>
</main>

<style>
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00aa);
  }
  .read-the-docs {
    color: #888;
  }

  h1 {
    font-size: 3em;
    margin-bottom: 0.2em;
  }

  h2 {
    font-size: 1.5em;
    color: #4f46e5;
    margin-bottom: 1em;
  }

  .subtitle {
    font-size: 1.1em;
    color: #666;
    margin-bottom: 2em;
  }

  .card {
    margin: 2em 0;
    padding: 2em;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: #f9fafb;
  }
</style>
