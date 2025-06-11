<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    currentThread,
    isAuthenticated,
    threads,
    threadActions,
  } from '../stores';
  
  import ChatPanel from './ChatPanel.svelte';
  import MessageInput from './MessageInput.svelte';
  import ThreadList from './ThreadList.svelte';
  import UserMenu from './UserMenu.svelte';
  import LiquidGlassButton from './LiquidGlassButton.svelte';
  import EnhancedGlass from './EnhancedGlass.svelte';
  
  let sidebarCollapsed = false;
  let showMobileMenu = false;
  let showAuthModal = false;
  
  // Handle responsive behavior
  let windowWidth = 0;
  $: isMobile = windowWidth < 768;
  
  // Don't auto-hide sidebar based on auth - always show the chat interface
  $: effectiveSidebarCollapsed = sidebarCollapsed;
  
  // Handle keyboard shortcuts
  function handleKeyDown(event: KeyboardEvent) {
    // Toggle sidebar with Cmd/Ctrl + B
    if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
      event.preventDefault();
      toggleSidebar();
    }
    
    // New thread with Cmd/Ctrl + N
    if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
      event.preventDefault();
      createNewThread();
    }
  }
  
  function toggleSidebar() {
    if (!$isAuthenticated) {
      showAuthModalDialog();
      return;
    }
    
    if (isMobile) {
      showMobileMenu = !showMobileMenu;
    } else {
      sidebarCollapsed = !sidebarCollapsed;
    }
  }
  
  function closeMobileMenu() {
    showMobileMenu = false;
  }
  
  function showAuthModalDialog() {
    if (!$isAuthenticated) {
      showAuthModal = true;
    }
  }
  
  function closeAuthModal() {
    showAuthModal = false;
  }
  
  async function createNewThread() {
    if (!$isAuthenticated) {
      showAuthModalDialog();
      return;
    }
    
    try {
      await threadActions.createThread('New Chat', false);
      closeMobileMenu();
    } catch (error) {
      console.error('Failed to create thread:', error);
    }
  }
  
  function handleThreadSelect(event: CustomEvent) {
    // Find the thread and select it
    const threadId = event.detail.threadId;
    const allThreads = $threads;
    const thread = allThreads.find(t => t.id === threadId);
    if (thread) {
      threadActions.selectThread(thread);
    }
    closeMobileMenu();
  }
  
  function handleThreadDelete(event: CustomEvent) {
    // TODO: Implement thread deletion when backend supports it
    console.log('Delete thread:', event.detail.threadId);
  }
  
  function handleThreadRename(event: CustomEvent) {
    // TODO: Implement thread renaming when backend supports it
    console.log('Rename thread:', event.detail.threadId, event.detail.title);
  }
  
  onMount(() => {
    if ($isAuthenticated) {
      threadActions.loadThreads();
    }
  });
</script>

<svelte:window bind:innerWidth={windowWidth} />
<svelte:body on:keydown={handleKeyDown} />

<div class="chat-ui" class:sidebar-collapsed={effectiveSidebarCollapsed}>
  <!-- Mobile Backdrop -->
  {#if isMobile && showMobileMenu}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div 
      class="mobile-backdrop liquid-glass-backdrop" 
      on:click={closeMobileMenu}
      on:keydown={(e) => e.key === 'Escape' && closeMobileMenu()}
      role="button"
      tabindex="-1"
      aria-label="Close mobile menu"
    ></div>
  {/if}
  
  <!-- Header -->
  <header class="chat-header liquid-glass-nav">
    <div class="header-left">
      <button 
        class="sidebar-toggle liquid-glass-button liquid-glass-focus"
        on:click={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      
      <div class="current-thread-info">
        {#if $currentThread}
          <h1 class="thread-title">{$currentThread.title}</h1>
        {:else}
          <h1 class="thread-title">TriChat</h1>
        {/if}
      </div>
    </div>
    
    <div class="header-right">
      <LiquidGlassButton
        variant="primary"
        size="small"
        onClick={createNewThread}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {#if !isMobile}
          <span style="margin-left: 6px;">New</span>
        {/if}
      </LiquidGlassButton>
      
      {#if !$isAuthenticated}
        <LiquidGlassButton
          variant="primary"
          size="small"
          onClick={showAuthModalDialog}
        >
          Sign In
        </LiquidGlassButton>
      {/if}
      
      <UserMenu 
        on:signedOut={() => {
          threads.set([]);
        }}
      />
    </div>
  </header>
  
  <!-- Main Content -->
  <div class="chat-content">
    <!-- Sidebar -->
    <aside 
      class="sidebar liquid-glass-sidebar" 
      class:collapsed={effectiveSidebarCollapsed}
      class:mobile-open={isMobile && showMobileMenu}
    >
      <div class="sidebar-content">
        <ThreadList 
          on:threadSelect={handleThreadSelect}
          on:threadDelete={handleThreadDelete}
          on:threadRename={handleThreadRename}
          on:createThread={() => createNewThread()}
        />
      </div>
    </aside>
    
    <!-- Main Chat Area -->
    <main class="chat-main">
      {#if $currentThread && $isAuthenticated}
        <!-- Chat Messages -->
        <div class="chat-messages">
          <ChatPanel />
        </div>
        
        <!-- Message Input -->
        <div class="chat-input liquid-glass">
          <MessageInput />
        </div>
      {:else}
        <!-- Welcome State -->
        <div class="welcome-state">
          <EnhancedGlass className="welcome-content-wrapper" borderRadius={32} padding="40px">
            <div class="welcome-content">
              <div class="welcome-icon-wrapper">
                <div class="welcome-icon">💬</div>
                <div class="icon-glow"></div>
              </div>
              <h2 class="welcome-title">
                {#if $isAuthenticated}
                  Start a new conversation
                {:else}
                  Welcome to TriChat
                {/if}
              </h2>
              <p class="welcome-description">
                {#if $isAuthenticated}
                  Choose from our AI models and start chatting. Your conversations will be saved and synchronized across devices.
                {:else}
                  Experience powerful AI conversations with multiple models. Sign in to save your chat history and access advanced features.
                {/if}
              </p>
              <div class="welcome-actions">
                <LiquidGlassButton
                  variant="primary"
                  size="large"
                  onClick={createNewThread}
                >
                  {#if $isAuthenticated}
                    Start New Chat
                  {:else}
                    Sign In to Start Chatting
                  {/if}
                </LiquidGlassButton>
              </div>
              <div class="feature-grid">
                <div class="feature-item">
                  <span class="feature-icon">🤖</span>
                  <span>Multiple AI Models</span>
                </div>
                <div class="feature-item">
                  <span class="feature-icon">💾</span>
                  <span>Save History</span>
                </div>
                <div class="feature-item">
                  <span class="feature-icon">🔒</span>
                  <span>Secure & Private</span>
                </div>
              </div>
            </div>
          </EnhancedGlass>
        </div>
      {/if}
    </main>
  </div>

  <!-- Sign In Modal Overlay -->
  {#if showAuthModal && !$isAuthenticated}
    <div 
      class="auth-overlay liquid-glass-backdrop" 
      on:click={closeAuthModal}
      on:keydown={(e) => e.key === 'Escape' && closeAuthModal()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      tabindex="-1"
    >
      <div 
        class="auth-modal liquid-glass-modal liquid-glass-depth" 
        on:click|stopPropagation
        on:keydown={(e) => e.key === 'Escape' && closeAuthModal()}
        role="document"
      >
        <div class="liquid-glass-layer"></div>
        <div class="auth-modal-content">
          <button class="close-button liquid-glass-button liquid-glass-focus" on:click={closeAuthModal} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          
          <div class="app-logo">
            <div class="logo-icon liquid-glass-animated">🚀</div>
            <h1>TriChat</h1>
            <p class="app-tagline">Multi-LLM Chat Application</p>
          </div>
          
          <div class="sign-in-section liquid-glass">
            <h2 id="auth-title">Sign in to continue</h2>
            <p>Access your chat history, manage conversations, and chat with multiple AI models.</p>
            <UserMenu />
          </div>
          
          <div class="features-preview">
            <div class="feature liquid-glass-card">
              <span class="feature-icon">🤖</span>
              <span>Multiple AI Models</span>
            </div>
            <div class="feature liquid-glass-card">
              <span class="feature-icon">💾</span>
              <span>Conversation History</span>
            </div>
            <div class="feature liquid-glass-card">
              <span class="feature-icon">🔒</span>
              <span>Secure & Private</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .chat-ui {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: transparent;
    overflow: hidden;
    position: relative;
    z-index: 1;
  }
  
  /* Header */
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    min-height: 60px;
    z-index: 100;
    position: relative;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .sidebar-toggle {
    padding: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  

  
  .current-thread-info {
    flex: 1;
    min-width: 0;
  }
  
  .thread-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgba(0, 0, 0, 0.8);
  }
  

  

  
  /* Content Layout */
  .chat-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  

  
  /* Sidebar */
  .sidebar {
    width: 300px;
    transition: all 0.3s ease;
    z-index: 50;
    flex-shrink: 0;
    position: relative;
  }
  
  .sidebar.collapsed {
    width: 0;
    overflow: hidden;
  }
  
  .sidebar-content {
    height: 100%;
    width: 300px;
    overflow: hidden;
    opacity: 1;
    transition: opacity 0.2s ease;
  }
  
  .sidebar.collapsed .sidebar-content {
    opacity: 0;
    pointer-events: none;
  }
  

  
  /* Main Chat Area */
  .chat-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  

  
  .chat-messages {
    flex: 1;
    overflow: hidden;
  }
  
  .chat-input {
    padding: 16px;
    position: relative;
  }
  
  /* Welcome State */
  .welcome-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  

  
  .welcome-content {
    text-align: center;
    position: relative;
    z-index: 1;
  }
  
  .welcome-icon-wrapper {
    position: relative;
    display: inline-block;
    margin-bottom: 32px;
  }
  
  .welcome-icon {
    font-size: 80px;
    filter: drop-shadow(0 8px 24px rgba(102, 126, 234, 0.4));
    animation: float 6s ease-in-out infinite;
  }
  
  @keyframes float {
    0%, 100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-10px) rotate(5deg);
    }
  }
  
  .icon-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 120px;
    height: 120px;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(102, 126, 234, 0.3) 0%, transparent 70%);
    filter: blur(20px);
    animation: pulse 3s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 0.5;
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      opacity: 0.8;
      transform: translate(-50%, -50%) scale(1.2);
    }
  }
  
  .welcome-title {
    margin: 0 0 16px 0;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: rgba(0, 0, 0, 0.9);
  }
  
  .welcome-description {
    margin: 0 0 36px 0;
    font-size: 18px;
    color: rgba(0, 0, 0, 0.7);
    line-height: 1.6;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  }
  
  .welcome-actions {
    margin-bottom: 48px;
  }
  
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-top: 48px;
    padding-top: 48px;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .feature-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
  }
  
  .feature-item:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
  }
  
  .feature-icon {
    font-size: 32px;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
  }
  
  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .welcome-title {
      color: rgba(255, 255, 255, 0.95);
    }
    
    .welcome-description {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .feature-grid {
      border-top-color: rgba(255, 255, 255, 0.1);
    }
    
    .feature-item {
      background: rgba(255, 255, 255, 0.03);
      color: rgba(255, 255, 255, 0.8);
    }
    
    .feature-item:hover {
      background: rgba(255, 255, 255, 0.06);
    }
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .welcome-title {
      font-size: 24px;
    }
    
    .welcome-description {
      font-size: 16px;
    }
    
    .feature-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    
    .feature-item {
      flex-direction: row;
      gap: 16px;
      justify-content: center;
    }
  }
  

  
  /* Auth Overlay */
  .auth-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  }
  
  .liquid-glass-backdrop {
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(12px) saturate(180%);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .auth-modal {
    max-width: 480px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.3s ease;
    position: relative;
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .auth-modal-content {
    padding: 40px;
    text-align: center;
    position: relative;
    z-index: 1;
  }
  
  .close-button {
    position: absolute;
    top: 16px;
    right: 16px;
    cursor: pointer;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }
  
  .app-logo {
    margin-bottom: 32px;
  }
  
  .logo-icon {
    font-size: 64px;
    margin-bottom: 16px;
    filter: drop-shadow(0 8px 24px rgba(102, 126, 234, 0.4));
  }
  
  .app-logo h1 {
    margin: 0 0 8px 0;
    font-size: 32px;
    font-weight: 800;
    color: rgba(0, 0, 0, 0.9);
  }
  
  .app-tagline {
    margin: 0;
    font-size: 16px;
    color: rgba(0, 0, 0, 0.6);
    font-weight: 500;
  }
  
  .sign-in-section {
    margin-bottom: 32px;
    padding: 24px;
    position: relative;
  }
  
  .sign-in-section h2 {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.9);
  }
  
  .sign-in-section p {
    margin: 0 0 20px 0;
    font-size: 14px;
    color: rgba(0, 0, 0, 0.7);
    line-height: 1.5;
  }
  
  .features-preview {
    display: flex;
    justify-content: center;
    gap: 16px;
  }
  
  .feature {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    padding: 16px;
    border-radius: 16px;
    color: rgba(0, 0, 0, 0.8);
  }
  
  .feature-icon {
    font-size: 24px;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
  }
  
  /* Mobile Styles */
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      top: 60px;
      left: 0;
      bottom: 0;
      width: 300px;
      transform: translateX(-100%);
      z-index: 200;
    }
    
    .sidebar.mobile-open {
      transform: translateX(0);
    }
    
    .mobile-backdrop {
      position: fixed;
      top: 60px;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 150;
    }
    
    .chat-main {
      width: 100%;
    }
    
    .thread-title {
      font-size: 16px;
    }
    
    .features-preview {
      flex-direction: column;
      gap: 12px;
    }
    
    .feature {
      flex-direction: row;
      justify-content: center;
      gap: 8px;
    }
    
    .auth-modal {
      margin: 20px;
      width: calc(100% - 40px);
    }
    
    .auth-modal-content {
      padding: 24px;
    }
    
    .app-logo h1 {
      font-size: 28px;
    }
    
    .logo-icon {
      font-size: 48px;
    }
  }
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .thread-title {
      color: rgba(255, 255, 255, 0.9);
    }
    
    .welcome-content h2 {
      color: rgba(255, 255, 255, 0.95);
    }
    
    .welcome-content p {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .app-logo h1 {
      color: rgba(255, 255, 255, 0.95);
    }
    
    .app-tagline {
      color: rgba(255, 255, 255, 0.6);
    }
    
    .sign-in-section h2 {
      color: rgba(255, 255, 255, 0.9);
    }
    
    .sign-in-section p {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .feature {
      color: rgba(255, 255, 255, 0.8);
    }
  }
</style> 