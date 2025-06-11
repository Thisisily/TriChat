<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
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
  import LiquidGlassButton from './LiquidGlassButton.svelte';

  // Props
  export let placeholder = 'Type a message...';
  export let maxLength = 4000;
  export let disabled = false;

  // Component state
  let textarea: HTMLTextAreaElement;
  let message = '';
  let isComposing = false;
  // let showEmojiPicker = false;
  let files: FileList | null = null;
  let fileInput: HTMLInputElement;
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    send: { content: string; files?: File[] };
    command: { command: string; args: string[] };
    typing: { isTyping: boolean };
  }>();

  // Emoji shortcuts
  const emojiShortcuts = {
    ':)': '😊',
    ':-)': '😊',
    ':(': '😢',
    ':-(': '😢',
    ':D': '😃',
    ':-D': '😃',
    ':P': '😛',
    ':-P': '😛',
    ';)': '😉',
    ';-)': '😉',
    ':o': '😮',
    ':-o': '😮',
    '<3': '❤️',
    '</3': '💔',
    ':thumbsup:': '👍',
    ':thumbsdown:': '👎',
    ':fire:': '🔥',
    ':rocket:': '🚀',
    ':tada:': '🎉',
    ':thinking:': '🤔',
    ':shrug:': '🤷‍♂️',
  };

  // Common commands
  const commands = {
    '/help': 'Show available commands',
    '/clear': 'Clear the current conversation',
    '/new': 'Start a new conversation',
    '/model': 'Change AI model (e.g., /model gpt-4)',
    '/export': 'Export conversation history',
    '/settings': 'Open settings',
  };

  // Auto-resize textarea
  function autoResize() {
    if (!textarea) return;
    
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  // Handle input changes
  function handleInput() {
    autoResize();
    handleTypingIndicator();
    processEmojiShortcuts();
  }

  // Process emoji shortcuts
  function processEmojiShortcuts() {
    let newMessage = message;
    
    for (const [shortcut, emoji] of Object.entries(emojiShortcuts)) {
      const regex = new RegExp(`\\${shortcut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      newMessage = newMessage.replace(regex, emoji);
    }
    
    if (newMessage !== message) {
      message = newMessage;
      setTimeout(() => {
        if (textarea) {
          textarea.setSelectionRange(message.length, message.length);
        }
      }, 0);
    }
  }

  // Handle typing indicators
  function handleTypingIndicator() {
    if (!$currentUser || !$currentThread) return;
    
    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Send typing indicator
    if (message.trim()) {
      streamingActions.updatePresence('typing', $currentThread.id);
      dispatch('typing', { isTyping: true });
      
      // Stop typing after 2 seconds of inactivity
      typingTimeout = setTimeout(() => {
        streamingActions.updatePresence('online', $currentThread.id);
        dispatch('typing', { isTyping: false });
      }, 2000);
    } else {
      streamingActions.updatePresence('online', $currentThread.id);
      dispatch('typing', { isTyping: false });
    }
  }

  // Handle keyboard shortcuts
  function handleKeyDown(event: KeyboardEvent) {
    if (isComposing) return;

    // Ctrl/Cmd + Enter to send
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSend();
      return;
    }

    // Escape to clear or cancel
    if (event.key === 'Escape') {
      event.preventDefault();
      if (message.trim()) {
        message = '';
        autoResize();
      } else {
        textarea.blur();
      }
      return;
    }

    // Shift + Enter for new line (default behavior)
    if (event.shiftKey && event.key === 'Enter') {
      return; // Allow default behavior
    }

    // Enter to send (if not shift+enter)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
      return;
    }

    // Handle command completion with Tab
    if (event.key === 'Tab' && message.startsWith('/')) {
      event.preventDefault();
      handleCommandCompletion();
      return;
    }
  }

  // Handle command completion
  function handleCommandCompletion() {
    const inputCommand = message.toLowerCase();
    const matchingCommands = Object.keys(commands).filter(cmd => 
      cmd.startsWith(inputCommand)
    );
    
    if (matchingCommands.length === 1) {
      message = matchingCommands[0] + ' ';
      setTimeout(() => {
        if (textarea) {
          textarea.setSelectionRange(message.length, message.length);
        }
      }, 0);
    }
  }

  // Handle sending messages
  async function handleSend() {
    if (!message.trim() && !files?.length) return;
    if ($sendingMessage) return;
    if (!$currentThread) {
      console.error('No thread selected');
      return;
    }

    const content = message.trim();
    
    // Check for commands
    if (content.startsWith('/')) {
      handleCommand(content);
      return;
    }

    try {
      // Clear input immediately for better UX
      const messageToSend = content;
      const filesToSend = files ? Array.from(files) : undefined;
      
      message = '';
      files = null;
      if (fileInput) fileInput.value = '';
      autoResize();

      // Stop typing indicator
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      streamingActions.updatePresence('online', $currentThread.id);
      dispatch('typing', { isTyping: false });

      // Dispatch send event
      dispatch('send', { content: messageToSend, files: filesToSend });

      // For now, we'll use the existing messageActions.sendMessage
      // In the future, this would integrate with the streaming API
      await messageActions.sendMessage(messageToSend, 'gpt-4', 'openai');
      
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore message on error
      message = content;
      autoResize();
    }
  }

  // Handle commands
  function handleCommand(input: string) {
    const [command, ...args] = input.split(' ');
    
    switch (command.toLowerCase()) {
      case '/help':
        showHelp();
        break;
      case '/clear':
        handleClearCommand();
        break;
      case '/new':
        handleNewCommand();
        break;
      case '/model':
        handleModelCommand(args[0]);
        break;
      default:
        // Unknown command
        message = '';
        autoResize();
        alert(`Unknown command: ${command}\nType /help for available commands.`);
        return;
    }
    
    message = '';
    autoResize();
    dispatch('command', { command: command.toLowerCase(), args });
  }

  // Command handlers
  function showHelp() {
    const helpMessage = Object.entries(commands)
      .map(([cmd, desc]) => `${cmd} - ${desc}`)
      .join('\n');
    alert(`Available commands:\n\n${helpMessage}`);
  }

  function handleClearCommand() {
    if (confirm('Clear the current conversation? This cannot be undone.')) {
      // This would clear the current thread's messages
      console.log('Clear command executed');
    }
  }

  function handleNewCommand() {
    // This would create a new thread
    console.log('New conversation command executed');
  }

  function handleModelCommand(model?: string) {
    if (!model) {
      alert('Usage: /model <model-name>\nExample: /model gpt-4');
      return;
    }
    
    console.log(`Switch to model: ${model}`);
    // This would change the current model
  }

  // Handle file selection
  function handleFileSelect() {
    fileInput?.click();
  }

  function handleFileChange() {
    // Validate files
    if (files && files.length > 0) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const validFiles = Array.from(files).filter(file => {
        if (file.size > maxSize) {
          alert(`File "${file.name}" is too large. Max size is 10MB.`);
          return false;
        }
        return true;
      });
      
      if (validFiles.length !== files.length) {
        // Update files list to only include valid files
        const dt = new DataTransfer();
        validFiles.forEach(file => dt.items.add(file));
        files = dt.files;
      }
    }
  }

  // Character count and validation
  $: characterCount = message.length;
  $: isOverLimit = characterCount > maxLength;
  $: canSend = !$sendingMessage && 
               (message.trim().length > 0 || files?.length) && 
               !isOverLimit && 
               !disabled &&
               $currentThread;

  // Focus management
  // function focusInput() {
  //   textarea?.focus();
  // }

  onMount(() => {
    autoResize();
  });
</script>

<div class="message-input liquid-glass">
  <!-- File preview -->
  {#if files && files.length > 0}
    <div class="file-preview">
      {#each Array.from(files) as file}
        <div class="file-item liquid-glass-card">
          <span class="file-icon">📎</span>
          <span class="file-name">{file.name}</span>
          <span class="file-size">({(file.size / 1024).toFixed(1)}KB)</span>
          <button 
            class="remove-file liquid-glass-button liquid-glass-focus" 
            on:click={() => {
              if (files) {
                const dt = new DataTransfer();
                Array.from(files).forEach(f => {
                  if (f !== file) dt.items.add(f);
                });
                files = dt.files.length > 0 ? dt.files : null;
                if (fileInput) fileInput.value = '';
              }
            }}
          >
            ×
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Main input area -->
  <div class="input-container liquid-glass-card liquid-glass-depth">
    <div class="liquid-glass-layer"></div>
    <!-- Hidden file input -->
    <input
      type="file"
      bind:this={fileInput}
      bind:files
      on:change={handleFileChange}
      multiple
      accept="image/*,text/*,.pdf,.doc,.docx"
      style="display: none;"
    />

    <!-- Action buttons (left side) -->
    <div class="input-actions-left">
      <button
        class="action-button file-button liquid-glass-button liquid-glass-focus"
        on:click={handleFileSelect}
        disabled={disabled}
        title="Attach files"
      >
        📎
      </button>
    </div>

    <!-- Text input -->
    <div class="input-wrapper">
      <textarea
        bind:this={textarea}
        bind:value={message}
        on:input={handleInput}
        on:keydown={handleKeyDown}
        on:compositionstart={() => isComposing = true}
        on:compositionend={() => isComposing = false}
        {placeholder}
        {disabled}
        maxlength={maxLength}
        rows="1"
        class="message-textarea liquid-glass-input"
        class:over-limit={isOverLimit}
      ></textarea>
      
      <!-- Character count -->
      <div class="character-count" class:over-limit={isOverLimit}>
        {characterCount}/{maxLength}
      </div>
    </div>

    <!-- Action buttons (right side) -->
    <div class="input-actions-right">
      <!-- Connection status indicator -->
      <div class="connection-indicator">
        {#if $connectionStatus.state === 'connected'}
          <span class="status-dot connected" title="Connected via {$connectionStatus.type}"></span>
        {:else if $connectionStatus.state === 'connecting' || $connectionStatus.state === 'reconnecting'}
          <span class="status-dot connecting" title="Connecting..."></span>
        {:else}
          <span class="status-dot disconnected" title="Disconnected"></span>
        {/if}
      </div>

      <!-- Send button -->
      <LiquidGlassButton
        variant="primary"
        size="small"
        disabled={!canSend}
        onClick={handleSend}
        className="send-button"
      >
        {#if $sendingMessage}
          <div class="spinner"></div>
        {:else}
          <span class="send-icon">➤</span>
        {/if}
      </LiquidGlassButton>
    </div>
  </div>

  <!-- Helper text -->
  <div class="input-footer">
    <div class="keyboard-shortcuts">
      <span class="shortcut"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to send</span>
      <span class="shortcut"><kbd>Shift</kbd> + <kbd>Enter</kbd> for new line</span>
      <span class="shortcut"><kbd>Esc</kbd> to clear</span>
      <span class="shortcut">Type <code>/help</code> for commands</span>
    </div>
  </div>
</div>

<style>
  .message-input {
    padding: 16px 20px;
    position: relative;
  }

  .file-preview {
    margin-bottom: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    font-size: 12px;
    position: relative;
  }

  .file-name {
    font-weight: 500;
  }

  .file-size {
    color: #6b7280;
  }

  .remove-file {
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .input-container {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 12px 16px;
    position: relative;
    z-index: 1;
  }

  .input-container:focus-within {
    transform: scale(1.01);
  }

  .input-actions-left,
  .input-actions-right {
    display: flex;
    align-items: flex-end;
    gap: 6px;
  }

  .action-button {
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    padding: 0;
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
  }

  .message-textarea {
    width: 100%;
    background: transparent !important;
    resize: none;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    min-height: 24px;
    max-height: 120px;
    padding: 8px 12px;
  }

  .message-textarea::placeholder {
    color: rgba(0, 0, 0, 0.5);
  }

  .message-textarea.over-limit {
    color: #ef4444;
  }

  .character-count {
    position: absolute;
    bottom: -18px;
    right: 8px;
    font-size: 10px;
    color: #9ca3af;
    pointer-events: none;
  }

  .character-count.over-limit {
    color: #ef4444;
    font-weight: 600;
  }

  .connection-indicator {
    display: flex;
    align-items: center;
    padding: 4px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: block;
  }

  .status-dot.connected {
    background: #10b981;
    animation: pulse-green 2s infinite;
  }

  .status-dot.connecting {
    background: #f59e0b;
    animation: pulse-yellow 1s infinite;
  }

  .status-dot.disconnected {
    background: #ef4444;
  }



  .send-icon {
    font-size: 16px;
    font-weight: bold;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .input-footer {
    margin-top: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .keyboard-shortcuts {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: #6b7280;
  }

  .shortcut {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  kbd {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 3px;
    padding: 2px 4px;
    font-size: 10px;
    font-family: monospace;
  }

  code {
    background: #f3f4f6;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: monospace;
    font-size: 10px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes pulse-green {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes pulse-yellow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .message-textarea::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    .character-count {
      color: rgba(255, 255, 255, 0.5);
    }

    .keyboard-shortcuts {
      color: rgba(255, 255, 255, 0.6);
    }

    kbd, code {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.9);
    }
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .message-input {
      padding: 12px 16px;
    }

    .keyboard-shortcuts {
      flex-wrap: wrap;
      gap: 8px;
    }

    .shortcut {
      font-size: 10px;
    }

    .input-container {
      padding: 6px 10px;
    }



    .action-button {
      width: 28px;
      height: 28px;
      font-size: 14px;
    }
  }

  /* Hide some shortcuts on very small screens */
  @media (max-width: 480px) {
    .keyboard-shortcuts .shortcut:nth-child(3),
    .keyboard-shortcuts .shortcut:nth-child(4) {
      display: none;
    }
  }
</style> 