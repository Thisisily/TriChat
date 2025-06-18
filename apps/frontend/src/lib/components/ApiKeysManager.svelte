<script lang="ts">
  import { onMount } from 'svelte';
  import LiquidGlassButton from './LiquidGlassButton.svelte';
  import EnhancedGlass from './EnhancedGlass.svelte';
  import { trpc } from '../trpc';
  
  interface ApiKey {
    id: string;
    provider: string;
    keyName: string;
    createdAt: string;
  }
  
  interface Provider {
    name: string;
    id: string;
    description: string;
    icon: string;
  }
  
  const providers: Provider[] = [
    { name: 'OpenAI', id: 'openai', description: 'GPT-4, GPT-3.5', icon: '🤖' },
    { name: 'Claude', id: 'anthropic', description: 'Claude 2, Claude Instant', icon: '🧠' },
    { name: 'Google', id: 'google', description: 'Gemini Pro, PaLM', icon: '🌟' },
    { name: 'Grok', id: 'xai', description: 'Grok AI', icon: '🚀' },
    { name: 'Llama', id: 'meta', description: 'Llama 2', icon: '🦙' },
    { name: 'Mistral', id: 'mistral', description: 'Mistral 7B', icon: '🌪️' },
  ];
  
  let apiKeys: ApiKey[] = [];
  let loading = false;
  let error = '';
  let selectedProvider: Provider | null = null;
  let keyName = '';
  let apiKey = '';
  let showAddForm = false;
  let saving = false;
  
  async function loadApiKeys() {
    loading = true;
    error = '';
    
    try {
      const result = await trpc.auth.getApiKeys.query();
      apiKeys = result.apiKeys.map(key => ({
        ...key,
        createdAt: key.createdAt instanceof Date ? key.createdAt.toISOString() : key.createdAt
      }));
    } catch (e) {
      console.error('Failed to load API keys:', e);
      error = 'Failed to load API keys';
    }
    
    loading = false;
  }
  
  async function saveApiKey() {
    if (!selectedProvider || !keyName || !apiKey) {
      error = 'Please fill all fields';
      return;
    }
    
    saving = true;
    error = '';
    
    try {
      await trpc.auth.addApiKey.mutate({
        provider: selectedProvider.id,
        keyName,
        apiKey,
      });
      
      // Reset form
      selectedProvider = null;
      keyName = '';
      apiKey = '';
      showAddForm = false;
      
      // Reload keys
      await loadApiKeys();
    } catch (e) {
      console.error('Failed to save API key:', e);
      error = 'Failed to save API key';
    }
    
    saving = false;
  }
  
  async function deleteApiKey(id: string) {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }
    
    error = '';
    
    try {
      await trpc.auth.deleteApiKey.mutate({ id });
      await loadApiKeys();
    } catch (e) {
      console.error('Failed to delete API key:', e);
      error = 'Failed to delete API key';
    }
  }
  
  function selectProvider(provider: Provider) {
    selectedProvider = provider;
    showAddForm = true;
    keyName = `My ${provider.name} Key`;
  }
  
  function getProviderName(providerId: string): string {
    const provider = providers.find(p => p.id === providerId);
    return provider?.name || providerId;
  }
  
  function getProviderIcon(providerId: string): string {
    const provider = providers.find(p => p.id === providerId);
    return provider?.icon || '🔑';
  }
  
  onMount(() => {
    loadApiKeys();
  });
</script>

<div class="api-keys-manager">
  <div class="manager-header">
    <h2>API Keys</h2>
    <p class="subtitle">Add your API keys to use different AI models</p>
  </div>
  
  {#if error}
    <div class="error-message liquid-glass-error">
      {error}
    </div>
  {/if}
  
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading API keys...</p>
    </div>
  {:else if showAddForm && selectedProvider}
          <EnhancedGlass className="add-form" borderRadius={16} padding="24px" elasticity={0}>
      <h3>Add {selectedProvider.name} API Key</h3>
      
      <div class="form-group">
        <label for="key-name">Key Name</label>
        <input
          id="key-name"
          type="text"
          bind:value={keyName}
          placeholder="e.g., My OpenAI Key"
          class="liquid-glass-input"
        />
      </div>
      
      <div class="form-group">
        <label for="api-key">API Key</label>
        <input
          id="api-key"
          type="password"
          bind:value={apiKey}
          placeholder="sk-..."
          class="liquid-glass-input"
        />
      </div>
      
      <div class="form-actions">
        <LiquidGlassButton
          variant="secondary"
          onClick={() => {
            showAddForm = false;
            selectedProvider = null;
            keyName = '';
            apiKey = '';
          }}
          disabled={saving}
        >
          Cancel
        </LiquidGlassButton>
        
        <LiquidGlassButton
          variant="primary"
          onClick={saveApiKey}
          disabled={saving || !keyName || !apiKey}
        >
          {saving ? 'Saving...' : 'Save Key'}
        </LiquidGlassButton>
      </div>
    </EnhancedGlass>
  {:else}
    <!-- Provider Grid -->
    <div class="provider-grid">
      {#each providers as provider}
        {@const hasKey = apiKeys.some(k => k.provider === provider.id)}
        <EnhancedGlass
          className="provider-card {hasKey ? 'has-key' : ''}"
          borderRadius={12}
          padding="20px"
          elasticity={0}
        >
          <div class="provider-header">
            <span class="provider-icon">{provider.icon}</span>
            <h3>{provider.name}</h3>
            {#if hasKey}
              <span class="status-badge liquid-glass-success">Active</span>
            {/if}
          </div>
          <p class="provider-description">{provider.description}</p>
          
          {#if hasKey}
            <div class="existing-keys">
              {#each apiKeys.filter(k => k.provider === provider.id) as key}
                <div class="key-item">
                  <span class="key-name">{key.keyName}</span>
                  <button
                    class="delete-button"
                    on:click={() => deleteApiKey(key.id)}
                    aria-label="Delete {key.keyName}"
                  >
                    ✕
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          
          <LiquidGlassButton
            variant={hasKey ? "secondary" : "primary"}
            size="small"
            onClick={() => selectProvider(provider)}
          >
            {hasKey ? 'Add Another' : 'Add Key'}
          </LiquidGlassButton>
        </EnhancedGlass>
      {/each}
    </div>
  {/if}
</div>

<style>
  .api-keys-manager {
    padding: 32px 24px;
    max-width: 800px;
    margin: 0 auto;
    min-height: 100%;
  }
  
  .manager-header {
    margin-bottom: 32px;
  }
  
  .manager-header h2 {
    margin: 0 0 8px 0;
    font-size: 28px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }
  
  .subtitle {
    margin: 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 16px;
  }
  
  .error-message {
    padding: 12px 16px;
    margin-bottom: 24px;
    border-radius: 8px;
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.15);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 107, 107, 0.3);
  }
  
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 48px;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: rgba(33, 150, 243, 0.8);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* Provider Grid */
  .provider-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
    margin-top: 8px;
  }
  
  .provider-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  
  .provider-card:hover {
    transform: translateY(-2px);
  }
  
  .provider-card.has-key {
    border-color: rgba(76, 175, 80, 0.3);
  }
  
  .provider-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .provider-icon {
    font-size: 32px;
  }
  
  .provider-header h3 {
    margin: 0;
    flex: 1;
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }
  
  .status-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .liquid-glass-success {
    background: rgba(76, 175, 80, 0.2);
    color: #81c784;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(76, 175, 80, 0.3);
  }
  
  .provider-description {
    margin: 0 0 16px 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
  }
  
  .existing-keys {
    margin-bottom: 16px;
  }
  
  .key-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    margin-bottom: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .key-name {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .delete-button {
    background: none;
    border: none;
    color: #ff6b6b;
    cursor: pointer;
    padding: 4px 8px;
    font-size: 16px;
    line-height: 1;
    opacity: 0.8;
    transition: all 0.2s ease;
    border-radius: 4px;
  }
  
  .delete-button:hover {
    opacity: 1;
    background: rgba(255, 107, 107, 0.1);
  }
  
  /* Add Form */
  .add-form h3 {
    margin: 0 0 24px 0;
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .liquid-glass-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(8px);
    color: rgba(255, 255, 255, 0.95);
    font-size: 16px;
    transition: all 0.2s ease;
  }

  .liquid-glass-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  
  .liquid-glass-input:focus {
    outline: none;
    border-color: rgba(33, 150, 243, 0.5);
    background: rgba(0, 0, 0, 0.3);
    box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.2);
  }
  
  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
  }
  
  @media (max-width: 768px) {
    .api-keys-manager {
      padding: 24px 16px;
    }
    
    .provider-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    
    .manager-header h2 {
      font-size: 24px;
    }
    
    .subtitle {
      font-size: 15px;
    }
  }
</style> 