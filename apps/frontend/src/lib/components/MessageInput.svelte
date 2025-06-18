<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    sendingMessage, 
    messageActions,
    currentThread 
  } from '../stores/threads';
  import { 
    streamingActions, 
    connectionStatus 
  } from '../streaming';
  import { currentUser } from '../stores/auth';
  import { isAuthenticated } from '../stores/auth';
  import { trpc } from '../trpc';
  import LiquidGlassButton from './LiquidGlassButton.svelte';
  import EnhancedGlass from './EnhancedGlass.svelte';

  // Props
  export let placeholder = 'Type a message...';
  export let maxLength = 4000;
  export let disabled = false;
  export let trinityMode = false;
  export let autoMemoryEnabled = false;
  export let trinityConfig = {
    executionMode: 'parallel' as 'parallel' | 'sequential' | 'hybrid',
    preset: 'problem-solving'
  };

  // Component state
  let textarea: HTMLTextAreaElement;
  let message = '';
  let isComposing = false;
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let selectedModel = 'gpt-4o-mini';
  let selectedProvider = 'openai';

  // Available models
  const models = [
    { provider: 'openai', model: 'gpt-4o', name: 'GPT-4o', icon: '🤖' },
    { provider: 'openai', model: 'gpt-4o-mini', name: 'GPT-4o Mini', icon: '⚡' },
    { provider: 'openai', model: 'gpt-3.5-turbo', name: 'GPT-3.5', icon: '💬' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet', name: 'Claude 3.5', icon: '🧠' },
    { provider: 'google', model: 'gemini-1.5-pro', name: 'Gemini Pro', icon: '✨' },
    { provider: 'openrouter', model: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3', icon: '🦙' },
  ];

  // Auto-resize textarea
  function autoResize() {
    if (!textarea) return;
    
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = newHeight + 'px';
  }

  // Handle input changes
  function handleInput() {
    autoResize();
    handleTypingIndicator();
  }

  // Handle typing indicators
  function handleTypingIndicator() {
    if (!$currentUser || !$currentThread) return;
    
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    if (message.trim()) {
      streamingActions.updatePresence('typing', $currentThread.id);
      
      typingTimeout = setTimeout(() => {
        streamingActions.updatePresence('online', $currentThread.id);
      }, 2000);
    } else {
      streamingActions.updatePresence('online', $currentThread.id);
    }
  }

  // Handle keyboard shortcuts
  function handleKeyDown(event: KeyboardEvent) {
    if (isComposing) return;

    // Enter to send (Shift+Enter for new line)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
      return;
    }
  }

  // Handle sending messages
  async function handleSend() {
    if (!message.trim() || $sendingMessage || disabled) return;
    
    if (!$currentThread) {
      // Create a new thread if none exists
      try {
        await messageActions.createThread();
      } catch (error) {
        console.error('Failed to create thread:', error);
        return;
      }
    }

    const content = message.trim();
    
    try {
      message = '';
      autoResize();

      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      if ($currentThread) {
        streamingActions.updatePresence('online', $currentThread.id);
      }

      if (trinityMode) {
        // Use Trinity Mode with configuration
        await messageActions.sendTrinityMessage(content, trinityConfig);
      } else {
        // Regular single-model message
      const [provider, model] = selectedModel.includes('/') 
        ? ['openrouter', selectedModel] 
        : [selectedProvider, selectedModel];

        await messageActions.sendMessage(content, model, provider, autoMemoryEnabled);
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      message = content;
      autoResize();
    }
  }

  onMount(() => {
    autoResize();
  });

  $: canSend = !$sendingMessage && message.trim().length > 0 && !disabled;
  $: currentModel = models.find(m => m.model === selectedModel);
</script>

<div class="chat-input-container">
  {#if !$isAuthenticated}
    <EnhancedGlass className="auth-prompt-wrapper darker" borderRadius={20} padding="24px" elasticity={0}>
      <p class="auth-prompt">Sign in to start chatting with AI models</p>
    </EnhancedGlass>
  {:else}
    <EnhancedGlass className="input-wrapper darker" borderRadius={24} padding="0" elasticity={0} blurAmount={20} saturation={160}>
      <div class="input-content">
        <!-- Model selector or Trinity Mode indicator -->
        {#if trinityMode}
          <div class="trinity-mode-indicator liquid-glass">
            <span class="trinity-icon">⚡</span>
            <span class="trinity-text">Trinity Mode</span>
          </div>
        {:else}
        <div class="model-selector liquid-glass">
          <span class="model-icon">{currentModel?.icon || '🤖'}</span>
          <select 
            bind:value={selectedModel}
            on:change={(e) => {
              const selected = models.find(m => m.model === e.currentTarget.value);
              if (selected) {
                selectedProvider = selected.provider;
              }
            }}
            class="model-select"
            disabled={disabled || $sendingMessage}
          >
            {#each models as model}
              <option value={model.model}>{model.name}</option>
            {/each}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="dropdown-icon">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </div>
        {/if}

        <!-- Message input area -->
        <div class="message-area">
          <textarea
            bind:this={textarea}
            bind:value={message}
            on:input={handleInput}
            on:keydown={handleKeyDown}
            on:compositionstart={() => isComposing = true}
            on:compositionend={() => isComposing = false}
            placeholder={disabled ? "Please wait..." : placeholder}
            disabled={disabled || $sendingMessage}
            maxlength={maxLength}
            rows="1"
            class="message-textarea"
          />
          
          <!-- Character count (only show when close to limit) -->
          {#if message.length > maxLength * 0.8}
            <div class="char-count liquid-glass" class:over={message.length > maxLength}>
              {message.length} / {maxLength}
            </div>
          {/if}
        </div>

        <!-- Send button -->
        <LiquidGlassButton
          variant={canSend ? "primary" : "secondary"}
          size="custom"
          disabled={!canSend}
          onClick={handleSend}
          className="send-button {canSend ? 'active' : ''}"
        >
          {#if $sendingMessage}
            <div class="spinner" />
          {:else}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          {/if}
        </LiquidGlassButton>
      </div>
    </EnhancedGlass>
  {/if}
</div>

<style>
  .chat-input-container {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  .auth-prompt-wrapper {
    text-align: center;
  }

  :global(.auth-prompt-wrapper.darker) {
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.25) !important,
      rgba(0, 0, 0, 0.15) !important
    );
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    backdrop-filter: blur(20px) saturate(160%) !important;
    box-shadow: 
      0 4px 30px rgba(0, 0, 0, 0.25) !important,
      inset 0 1px 0 rgba(255, 255, 255, 0.15) !important,
      inset 0 -1px 0 rgba(0, 0, 0, 0.2) !important;
  }

  .auth-prompt {
    margin: 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 16px;
  }

  .input-wrapper {
    width: 100%;
    position: relative;
  }

  :global(.input-wrapper.darker) {
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.25) !important,
      rgba(0, 0, 0, 0.15) !important
    );
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    backdrop-filter: blur(20px) saturate(160%) !important;
    box-shadow: 
      0 4px 30px rgba(0, 0, 0, 0.25) !important,
      inset 0 1px 0 rgba(255, 255, 255, 0.15) !important,
      inset 0 -1px 0 rgba(0, 0, 0, 0.2) !important;
  }

  .input-content {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
  }

  /* Model Selector */
  .model-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 16px;
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    backdrop-filter: blur(16px) saturate(160%);
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.15),
      rgba(0, 0, 0, 0.08)
    );
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .model-selector:hover {
    transform: scale(1.02);
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.2),
      rgba(0, 0, 0, 0.12)
    );
  }

  /* Trinity Mode Indicator */
  .trinity-mode-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 16px;
    flex-shrink: 0;
    backdrop-filter: blur(16px) saturate(160%);
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.15),
      rgba(118, 75, 162, 0.15)
    );
    border: 1px solid rgba(102, 126, 234, 0.3);
    box-shadow: 
      0 2px 8px rgba(102, 126, 234, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .trinity-icon {
    font-size: 20px;
    line-height: 1;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 0.8; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.1); }
  }

  .trinity-text {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .model-icon {
    font-size: 20px;
    line-height: 1;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }

  .model-select {
    background: transparent;
    border: none;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.95);
    cursor: pointer;
    outline: none;
    padding-right: 16px;
    appearance: none;
    -webkit-appearance: none;
  }

  .model-select option {
    background: #1a1a2e;
    color: rgba(255, 255, 255, 0.9);
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 500;
  }

  .model-select option:hover {
    background: #16213e;
  }

  /* Style the dropdown list */
  .model-select:focus option {
    background: #1a1a2e;
  }

  .model-select option:checked {
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .model-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dropdown-icon {
    position: absolute;
    right: 10px;
    pointer-events: none;
    color: rgba(255, 255, 255, 0.7);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }

  /* Message Area */
  .message-area {
    flex: 1;
    position: relative;
  }

  .message-textarea {
    width: 100%;
    padding: 12px 16px;
    border: none;
    background: transparent;
    font-size: 16px;
    line-height: 1.5;
    resize: none;
    outline: none;
    font-family: inherit;
    min-height: 44px;
    max-height: 200px;
    color: rgba(255, 255, 255, 0.95);
  }

  .message-textarea::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .message-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Character Count */
  .char-count {
    position: absolute;
    bottom: 4px;
    right: 8px;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(8px);
    background: rgba(0, 0, 0, 0.3);
  }

  .char-count.over {
    color: #ff6b6b;
    font-weight: 600;
    background: rgba(255, 107, 107, 0.2);
  }

  /* Send Button */
  :global(.send-button) {
    width: 44px !important;
    height: 44px !important;
    padding: 0 !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0;
  }

  :global(.send-button.active) {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(33, 150, 243, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
    }
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .chat-input-container {
      padding: 16px;
      padding-bottom: 20px;
    }

    .input-content {
      gap: 12px;
      padding: 12px 16px;
    }

    .model-selector {
      padding: 8px 12px;
    }

    .model-select {
      font-size: 13px;
    }

    .message-textarea {
      font-size: 16px; /* Prevents zoom on iOS */
    }

    :global(.send-button) {
      width: 40px !important;
      height: 40px !important;
    }
  }
</style> 