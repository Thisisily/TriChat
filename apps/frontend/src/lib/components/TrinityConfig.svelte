<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import EnhancedGlass from './EnhancedGlass.svelte';
  import LiquidGlassButton from './LiquidGlassButton.svelte';

  const dispatch = createEventDispatcher();

  export let show = false;
  export let initialConfig = {
    executionMode: 'parallel' as 'parallel' | 'sequential' | 'hybrid',
    preset: 'problem-solving',
    customWeights: {
      analytical: 0.4,
      creative: 0.35,
      factual: 0.25
    },
    agents: {
      analytical: {
        model: 'gpt-4o',
        provider: 'openai'
      },
      creative: {
        model: 'gpt-4o',
        provider: 'openai'
      },
      factual: {
        model: 'gpt-4o',
        provider: 'openai'
      }
    },
    orchestrator: {
      model: 'gpt-4o',
      provider: 'openai'
    },
    advanced: {
      prompts: {
        analytical: '',
        creative: '',
        factual: ''
      },
      temperatures: {
        analytical: 0.1,
        creative: 0.7,
        factual: 0.3
      }
    }
  };

  // Initialize config with proper structure
  let config = {
    executionMode: initialConfig?.executionMode || 'parallel',
    preset: initialConfig?.preset || 'problem-solving',
    customWeights: initialConfig?.customWeights || {
      analytical: 0.4,
      creative: 0.35,
      factual: 0.25
    },
    agents: initialConfig?.agents || {
      analytical: { model: 'gpt-4o', provider: 'openai' },
      creative: { model: 'gpt-4o', provider: 'openai' },
      factual: { model: 'gpt-4o', provider: 'openai' }
    },
    orchestrator: initialConfig?.orchestrator || {
      model: 'gpt-4o',
      provider: 'openai'
    },
    advanced: initialConfig?.advanced || {
      prompts: {
        analytical: '',
        creative: '',
        factual: ''
      },
      temperatures: {
        analytical: 0.1,
        creative: 0.7,
        factual: 0.3
      }
    }
  };

  let showAdvanced = false;

  // Available models - same as MessageInput
  const models = [
    { provider: 'openai', model: 'gpt-4o', name: 'GPT-4o', icon: '🤖' },
    { provider: 'openai', model: 'gpt-4o-mini', name: 'GPT-4o Mini', icon: '🤖' },
    { provider: 'openai', model: 'gpt-4-turbo', name: 'GPT-4 Turbo', icon: '🤖' },
    { provider: 'openai', model: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', icon: '🤖' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', icon: '🧠' },
    { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', icon: '🧠' },
    { provider: 'anthropic', model: 'claude-3-opus-20240229', name: 'Claude 3 Opus', icon: '🧠' },
    { provider: 'google', model: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', icon: '✨' },
    { provider: 'google', model: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', icon: '✨' },
    { provider: 'google', model: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', icon: '✨' },
    { provider: 'mistral', model: 'mistral-large-latest', name: 'Mistral Large', icon: '🌪️' },
    { provider: 'mistral', model: 'mistral-medium-latest', name: 'Mistral Medium', icon: '🌪️' },
    { provider: 'mistral', model: 'open-mistral-7b', name: 'Mistral 7B', icon: '🌪️' },
    { provider: 'openrouter', model: 'openai/gpt-4o', name: 'GPT-4o (OR)', icon: '🌐' },
    { provider: 'openrouter', model: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 (OR)', icon: '🌐' },
    { provider: 'openrouter', model: 'google/gemini-pro-1.5', name: 'Gemini Pro (OR)', icon: '🌐' },
    { provider: 'openrouter', model: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B (OR)', icon: '🌐' }
  ];

  // Available models grouped by provider
  $: allModels = models;
  $: modelsByProvider = allModels.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof models>);

  const presets = [
    { 
      id: 'problem-solving', 
      name: 'Problem Solving', 
      icon: '🎯',
      description: 'Balanced approach for complex problems',
      weights: { analytical: 0.4, creative: 0.35, factual: 0.25 },
      agents: {
        analytical: { model: 'gpt-4o', provider: 'openai' },
        creative: { model: 'gpt-4o', provider: 'openai' },
        factual: { model: 'gpt-4o-mini', provider: 'openai' }
      }
    },
    { 
      id: 'creative-writing', 
      name: 'Creative Writing', 
      icon: '✨',
      description: 'Creative-focused for storytelling',
      weights: { analytical: 0.2, creative: 0.6, factual: 0.2 },
      agents: {
        analytical: { model: 'gpt-4o-mini', provider: 'openai' },
        creative: { model: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
        factual: { model: 'gemini-1.5-flash', provider: 'google' }
      }
    },
    { 
      id: 'research-analysis', 
      name: 'Research Analysis', 
      icon: '📊',
      description: 'Fact-based analytical approach',
      weights: { analytical: 0.4, creative: 0.1, factual: 0.5 },
      agents: {
        analytical: { model: 'gpt-4o', provider: 'openai' },
        creative: { model: 'gpt-3.5-turbo', provider: 'openai' },
        factual: { model: 'gpt-4o', provider: 'openai' }
      }
    },
    { 
      id: 'brainstorming', 
      name: 'Brainstorming', 
      icon: '💡',
      description: 'Creative ideation and exploration',
      weights: { analytical: 0.2, creative: 0.7, factual: 0.1 },
      agents: {
        analytical: { model: 'claude-3-5-haiku-20241022', provider: 'anthropic' },
        creative: { model: 'claude-3-5-sonnet-20241022', provider: 'anthropic' },
        factual: { model: 'gpt-4o-mini', provider: 'openai' }
      }
    }
  ];

  const executionModes = [
    { 
      value: 'parallel', 
      name: 'Parallel', 
      icon: '⚡',
      description: 'All agents work simultaneously for fastest response'
    },
    { 
      value: 'sequential', 
      name: 'Sequential', 
      icon: '🔄',
      description: 'Agents work in order, each building on previous'
    },
    { 
      value: 'hybrid', 
      name: 'Hybrid', 
      icon: '🔀',
      description: 'Factual + Analytical first, then Creative'
    }
  ];

  function selectPreset(presetId: string) {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      config.preset = presetId;
      config.customWeights = { ...preset.weights };
      config.agents = { ...preset.agents };
    }
  }

  function updateAgentModel(agentType: 'analytical' | 'creative' | 'factual', modelValue: string) {
    const model = allModels.find(m => m.model === modelValue);
    if (model) {
      config.agents[agentType] = {
        model: model.model,
        provider: model.provider
      };
    }
  }

  function handleSave() {
    dispatch('save', config);
    show = false;
  }

  function handleClose() {
    dispatch('close');
    show = false;
  }

  $: selectedPreset = presets.find(p => p.id === config.preset);
</script>

{#if show}
  <div 
    class="trinity-config-overlay" 
    on:click={handleClose}
    transition:fade={{ duration: 200 }}
  >
    <div 
      class="trinity-config-modal"
      on:click|stopPropagation
      transition:fade={{ duration: 300 }}
    >
      <EnhancedGlass 
        className="modal-content" 
        borderRadius={24} 
        padding="0" 
        elasticity={0}
      >
        <div class="modal-inner">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-content">
              <div class="trinity-icon">⚡</div>
              <div>
                <h2>Trinity Mode Configuration</h2>
                <p>Configure how the three AI agents work together</p>
              </div>
            </div>
            <button class="close-btn" on:click={handleClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Execution Mode Selection -->
          <div class="config-section">
            <h3>Execution Mode</h3>
            <div class="mode-grid">
              {#each executionModes as mode}
                <button 
                  class="mode-card {config.executionMode === mode.value ? 'active' : ''}"
                  on:click={() => config.executionMode = mode.value as 'parallel' | 'sequential' | 'hybrid'}
                >
                  <span class="mode-icon">{mode.icon}</span>
                  <strong>{mode.name}</strong>
                  <p>{mode.description}</p>
                </button>
              {/each}
            </div>
          </div>

          <!-- Preset Selection -->
          <div class="config-section">
            <h3>Quick Presets</h3>
            <div class="preset-grid">
              {#each presets as preset}
                <button 
                  class="preset-card {config.preset === preset.id ? 'active' : ''}"
                  on:click={() => selectPreset(preset.id)}
                >
                  <span class="preset-icon">{preset.icon}</span>
                  <strong>{preset.name}</strong>
                  <p>{preset.description}</p>
                  <div class="weight-bars">
                    <div class="weight-bar analytical" style="width: {preset.weights.analytical * 100}%"></div>
                    <div class="weight-bar creative" style="width: {preset.weights.creative * 100}%"></div>
                    <div class="weight-bar factual" style="width: {preset.weights.factual * 100}%"></div>
                  </div>
                </button>
              {/each}
            </div>
          </div>

          <!-- Agent Model Configuration -->
          <div class="config-section">
            <h3>Agent Model Selection</h3>
            <div class="agent-configs">
              <!-- Analytical Agent -->
              <div class="agent-config">
                <div class="agent-header">
                  <span class="agent-icon">🔍</span>
                  <strong>Analytical Agent</strong>
                  <span class="weight-badge">{Math.round(config.customWeights.analytical * 100)}%</span>
                </div>
                <select 
                  class="model-select"
                  value={config.agents.analytical.model}
                  on:change={(e) => updateAgentModel('analytical', e.currentTarget.value)}
                >
                  {#each Object.entries(modelsByProvider) as [provider, models]}
                    <optgroup label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                      {#each models as model}
                        <option value={model.model}>
                          {model.icon} {model.name}
                        </option>
                      {/each}
                    </optgroup>
                  {/each}
                </select>
              </div>

              <!-- Creative Agent -->
              <div class="agent-config">
                <div class="agent-header">
                  <span class="agent-icon">🎨</span>
                  <strong>Creative Agent</strong>
                  <span class="weight-badge">{Math.round(config.customWeights.creative * 100)}%</span>
                </div>
                <select 
                  class="model-select"
                  value={config.agents.creative.model}
                  on:change={(e) => updateAgentModel('creative', e.currentTarget.value)}
                >
                  {#each Object.entries(modelsByProvider) as [provider, models]}
                    <optgroup label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                      {#each models as model}
                        <option value={model.model}>
                          {model.icon} {model.name}
                        </option>
                      {/each}
                    </optgroup>
                  {/each}
                </select>
              </div>

              <!-- Factual Agent -->
              <div class="agent-config">
                <div class="agent-header">
                  <span class="agent-icon">📚</span>
                  <strong>Factual Agent</strong>
                  <span class="weight-badge">{Math.round(config.customWeights.factual * 100)}%</span>
                </div>
                <select 
                  class="model-select"
                  value={config.agents.factual.model}
                  on:change={(e) => updateAgentModel('factual', e.currentTarget.value)}
                >
                  {#each Object.entries(modelsByProvider) as [provider, models]}
                    <optgroup label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                      {#each models as model}
                        <option value={model.model}>
                          {model.icon} {model.name}
                        </option>
                      {/each}
                    </optgroup>
                  {/each}
                </select>
              </div>
            </div>
          </div>

          <!-- Advanced Configuration -->
          <div class="config-section">
            <div class="section-header">
              <h3>Advanced Configuration</h3>
              <button 
                class="toggle-btn"
                on:click={() => showAdvanced = !showAdvanced}
              >
                {showAdvanced ? '−' : '+'}
              </button>
            </div>
            
            {#if showAdvanced}
              <div class="advanced-content">
                <!-- Temperature Settings -->
                <div class="advanced-subsection">
                  <h4>Temperature Settings</h4>
                  <p class="subsection-desc">Control creativity and randomness for each agent (0.0 = focused, 2.0 = creative)</p>
                  
                  <div class="temperature-controls">
                    <div class="temp-control">
                      <label>
                        <span class="agent-icon">🔍</span>
                        Analytical Temperature
                      </label>
                      <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.1"
                        bind:value={config.advanced.temperatures.analytical}
                      />
                      <span class="temp-value">{config.advanced.temperatures.analytical}</span>
                    </div>
                    
                    <div class="temp-control">
                      <label>
                        <span class="agent-icon">🎨</span>
                        Creative Temperature
                      </label>
                      <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.1"
                        bind:value={config.advanced.temperatures.creative}
                      />
                      <span class="temp-value">{config.advanced.temperatures.creative}</span>
                    </div>
                    
                    <div class="temp-control">
                      <label>
                        <span class="agent-icon">📚</span>
                        Factual Temperature
                      </label>
                      <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.1"
                        bind:value={config.advanced.temperatures.factual}
                      />
                      <span class="temp-value">{config.advanced.temperatures.factual}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Custom Prompts -->
                <div class="advanced-subsection">
                  <h4>Custom System Prompts</h4>
                  <p class="subsection-desc">Add specific instructions for each agent (optional)</p>
                  
                  <div class="prompt-controls">
                    <div class="prompt-control">
                      <label>
                        <span class="agent-icon">🔍</span>
                        Analytical Agent Prompt
                      </label>
                      <textarea 
                        placeholder="e.g., Focus on data analysis and logical reasoning..."
                        bind:value={config.advanced.prompts.analytical}
                        rows="3"
                      ></textarea>
                    </div>
                    
                    <div class="prompt-control">
                      <label>
                        <span class="agent-icon">🎨</span>
                        Creative Agent Prompt
                      </label>
                      <textarea 
                        placeholder="e.g., Think outside the box and suggest innovative solutions..."
                        bind:value={config.advanced.prompts.creative}
                        rows="3"
                      ></textarea>
                    </div>
                    
                    <div class="prompt-control">
                      <label>
                        <span class="agent-icon">📚</span>
                        Factual Agent Prompt
                      </label>
                      <textarea 
                        placeholder="e.g., Provide accurate facts and cite sources when possible..."
                        bind:value={config.advanced.prompts.factual}
                        rows="3"
                      ></textarea>
                    </div>
                  </div>
                </div>

                <!-- Orchestrator Model -->
                <div class="advanced-subsection">
                  <h4>Orchestrator Model</h4>
                  <p class="subsection-desc">Select the model that synthesizes the final response</p>
                  
                  <div class="agent-config">
                    <div class="agent-header">
                      <span class="agent-icon">✨</span>
                      <strong>Synthesis Model</strong>
                    </div>
                    <select 
                      class="model-select"
                      bind:value={config.orchestrator.model}
                    >
                      {#each Object.entries(modelsByProvider) as [provider, models]}
                        <optgroup label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                          {#each models as model}
                            <option value={model.model}>
                              {model.icon} {model.name}
                            </option>
                          {/each}
                        </optgroup>
                      {/each}
                    </select>
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Footer Actions -->
          <div class="modal-footer">
            <LiquidGlassButton
              variant="secondary"
              onClick={handleClose}
            >
              Cancel
            </LiquidGlassButton>
            <LiquidGlassButton
              variant="primary"
              onClick={handleSave}
            >
              Save Configuration
            </LiquidGlassButton>
          </div>
        </div>
      </EnhancedGlass>
    </div>
  </div>
{/if}

<style>
  .trinity-config-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .trinity-config-modal {
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    overflow: auto;
  }

  .modal-inner {
    padding: 32px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .trinity-icon {
    font-size: 48px;
    line-height: 1;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }

  .modal-header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .modal-header p {
    margin: 4px 0 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 8px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 1);
    transform: scale(1.05);
  }

  .config-section {
    margin-bottom: 32px;
  }

  .config-section h3 {
    margin: 0 0 16px;
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .mode-grid, .preset-grid {
    display: grid;
    gap: 16px;
  }

  .mode-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .preset-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }

  .mode-card, .preset-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-card:hover, .preset-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  .mode-card.active, .preset-card.active {
    background: rgba(102, 126, 234, 0.2);
    border-color: rgba(102, 126, 234, 0.4);
  }

  .mode-icon, .preset-icon {
    font-size: 32px;
    line-height: 1;
    display: block;
    margin-bottom: 12px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }

  .mode-card strong, .preset-card strong {
    display: block;
    margin-bottom: 8px;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.95);
  }

  .mode-card p, .preset-card p {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.4;
  }

  .weight-bars {
    display: flex;
    height: 4px;
    margin-top: 12px;
    border-radius: 2px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.1);
  }

  .weight-bar {
    height: 100%;
    transition: width 0.3s ease;
  }

  .weight-bar.analytical {
    background: #667eea;
  }

  .weight-bar.creative {
    background: #f093fb;
  }

  .weight-bar.factual {
    background: #4facfe;
  }

  .weights-display {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
  }

  .weight-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
  }

  .weight-item:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .weight-label {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.8);
  }

  .agent-icon {
    font-size: 20px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }

  .weight-value {
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .agent-configs {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .agent-config {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
  }

  .agent-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .agent-header strong {
    flex: 1;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.95);
  }

  .weight-badge {
    background: rgba(102, 126, 234, 0.2);
    border: 1px solid rgba(102, 126, 234, 0.4);
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .model-select {
    width: 100%;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.95);
    font-size: 15px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .model-select:hover {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .model-select:focus {
    outline: none;
    border-color: rgba(102, 126, 234, 0.5);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .model-select option {
    background: #1a1a2e;
    color: rgba(255, 255, 255, 0.9);
    padding: 12px;
  }

  .model-select optgroup {
    background: #0f0f1e;
    color: rgba(255, 255, 255, 0.6);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 12px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .toggle-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 8px 12px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 1);
    transform: scale(1.05);
  }

  .advanced-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .advanced-subsection {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
  }

  .advanced-subsection h4 {
    margin: 0 0 16px;
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .subsection-desc {
    margin: 0 0 16px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
  }

  .temperature-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .temp-control {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .temp-control label {
    flex: 0 0 200px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
  }

  .temp-control input[type="range"] {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .temp-control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: #667eea;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .temp-control input[type="range"]::-webkit-slider-thumb:hover {
    background: #5a67d8;
    transform: scale(1.2);
  }

  .temp-control input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #667eea;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .temp-control input[type="range"]::-moz-range-thumb:hover {
    background: #5a67d8;
    transform: scale(1.2);
  }

  .temp-value {
    flex: 0 0 40px;
    text-align: right;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .prompt-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .prompt-control {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .prompt-control label {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.8);
  }

  .prompt-control textarea {
    width: 100%;
    padding: 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.95);
    font-size: 15px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .prompt-control textarea:hover {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .prompt-control textarea:focus {
    outline: none;
    border-color: rgba(102, 126, 234, 0.5);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  @media (max-width: 768px) {
    .modal-inner {
      padding: 24px 20px;
    }

    .trinity-icon {
      font-size: 36px;
    }

    .mode-grid, .preset-grid {
      grid-template-columns: 1fr;
    }
  }
</style> 