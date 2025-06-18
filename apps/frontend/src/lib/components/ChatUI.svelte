<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { fade, fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { 
    threads,
    currentThread, 
    threadActions,
    currentMessages,
    type Thread 
  } from '../stores/threads';
  import { isAuthenticated, currentUser } from '../stores/auth';
  import { sidebarCollapsed } from '../stores/preferences';
  import { streamingActions } from '../streaming';
  import { trpc } from '../trpc';
  import ThreadList from './ThreadList.svelte';
  import MessageInput from './MessageInput.svelte';
  import UserMenu from './UserMenu.svelte';
  import ApiKeysManager from './ApiKeysManager.svelte';
  import SwipeGesture from './SwipeGesture.svelte';
  import KeyboardNavigation from './KeyboardNavigation.svelte';
  import LiquidGlassButton from './LiquidGlassButton.svelte';
  import EnhancedGlass from './EnhancedGlass.svelte';
  import ChatPanel from './ChatPanel.svelte';
  import MemoryCardList from './MemoryCardList.svelte';
  import ToastNotification from './ToastNotification.svelte';
  import TrinityConfig from './TrinityConfig.svelte';
  import type { Message } from '../stores/threads';
  
  import ScreenReaderAnnouncer from './ScreenReaderAnnouncer.svelte';
  import '../styles/liquid-glass.css';
  
  // Component state
  let showMobileMenu = false;
  let showSettingsModal = false;
  let showMemoryCards = false;
  let trinityModeEnabled = false;
  let autoMemoryEnabled = false;
  let showAuthModal = false;
  let showTrinityConfig = false;
  let settingsView: 'apikeys' | 'profile' = 'apikeys';
  
  // Trinity Mode config
  let trinityConfig = {
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
  
  // Accessibility
  let screenReaderAnnouncer: ScreenReaderAnnouncer | undefined;
  let announcementMessage = '';
  
  // Handle responsive behavior
  let windowWidth = 0;
  
  // Toast state
  let toastMessage = '';
  let toastType: 'success' | 'error' | 'info' = 'info';
  
  function announceToScreenReader(message: string, urgent = false) {
    if (screenReaderAnnouncer) {
      screenReaderAnnouncer.announce(message, urgent);
    } else {
      announcementMessage = message;
    }
  }
  
  // Reactive statements
  $: effectiveSidebarCollapsed = $sidebarCollapsed;
  $: isMobile = windowWidth < 768;
  
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
      announceToScreenReader(
        showMobileMenu ? 'Navigation menu opened' : 'Navigation menu closed'
      );
    } else {
      sidebarCollapsed.update(value => !value);
      announceToScreenReader(
        $sidebarCollapsed ? 'Sidebar collapsed' : 'Sidebar expanded'
      );
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
      announceToScreenReader('New chat thread created');
      closeMobileMenu();
    } catch (error) {
      console.error('Failed to create thread:', error);
      announceToScreenReader('Failed to create new thread', true);
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
  
  // Swipe gesture handlers for mobile
  function handleSwipeRight() {
    if (isMobile && !showMobileMenu) {
      showMobileMenu = true;
    }
  }
  
  function handleSwipeLeft() {
    if (isMobile && showMobileMenu) {
      showMobileMenu = false;
    }
  }
  
  // Touch-friendly keyboard shortcuts
  function handleMobileKeyboard(event: KeyboardEvent) {
    // Only trigger on mobile devices
    if (!isMobile) return;
    
    // Handle escape key to close mobile menu
    if (event.key === 'Escape' && showMobileMenu) {
      event.preventDefault();
      closeMobileMenu();
    }
  }
  
  async function handleSummarizeChat(event: CustomEvent<{ threadId: string }>) {
    const { threadId } = event.detail;
    try {
      // Get all messages for the thread
      const messages = get(currentMessages);
      if (messages.length === 0) {
        showToast?.('No messages to summarize', 'info');
        return;
      }
      
      // Format messages for summarization
      const conversationText = messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');
      
      // Create a summary using the memory integration
      const result = await trpc.memoryCards.create.mutate({
        title: `Chat Summary - ${new Date().toLocaleDateString()}`,
        content: conversationText,
        summary: `Summary of conversation from thread ${threadId}`,
      });
      
      if (result.memoryCard) {
        showToast?.('Chat summary created successfully!', 'success');
        // Refresh memory cards if the drawer is open
        if (showMemoryCards) {
          // The MemoryCardList component will auto-refresh
        }
      }
    } catch (error) {
      console.error('Error summarizing chat:', error);
      showToast?.('Failed to create chat summary', 'error');
    }
  }
  
  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    toastMessage = message;
    toastType = type;
  }
  
  onMount(() => {
    if ($isAuthenticated) {
      threadActions.loadThreads();
    }
  });
</script>

<svelte:window bind:innerWidth={windowWidth} />
<svelte:body on:keydown={handleKeyDown} />

<div class="chat-ui" 
  class:sidebar-collapsed={effectiveSidebarCollapsed}
  on:keydown={handleMobileKeyboard}
  tabindex="0"
  role="application"
  aria-label="TriChat application"
>
  <!-- Screen Reader Announcer -->
  <ScreenReaderAnnouncer 
    bind:this={screenReaderAnnouncer}
    message={announcementMessage}
    on:announced={() => announcementMessage = ''}
  />
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
  <header class="chat-header liquid-glass-nav" role="banner">
    <div class="header-left">
      <button 
        class="sidebar-toggle liquid-glass-button liquid-glass-focus"
        on:click={toggleSidebar}
        aria-label={isMobile 
          ? (showMobileMenu ? 'Close navigation menu' : 'Open navigation menu')
          : (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')
        }
        aria-expanded={isMobile ? showMobileMenu : !sidebarCollapsed}
        aria-controls="main-sidebar"
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
      <!-- Memory Cards Button -->
      <button
        class="header-action-btn memory-btn"
        class:active={showMemoryCards}
        on:click={() => showMemoryCards = !showMemoryCards}
        title="Toggle Memory Cards"
        aria-label="Toggle Memory Cards panel"
      >
        🧠
      </button>
      
      <!-- Trinity Mode Toggle -->
      <button
        class="header-action-btn trinity-btn"
        class:active={trinityModeEnabled}
        on:click={() => {
          if (!trinityModeEnabled) {
            showTrinityConfig = true;
          } else {
            trinityModeEnabled = false;
          }
        }}
        title="Toggle Trinity Mode (3 AI agents)"
        aria-label="Toggle Trinity Mode"
      >
        ⚡
      </button>
      
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
        on:openApiKeys={() => {
          showSettingsModal = true;
          settingsView = 'apikeys';
        }}
      />
    </div>
  </header>
  
  <!-- Main Content -->
  <div class="chat-content">
    <!-- Sidebar -->
    <aside 
      id="main-sidebar"
      class="sidebar liquid-glass-sidebar" 
      class:collapsed={effectiveSidebarCollapsed}
      class:mobile-open={isMobile && showMobileMenu}
      role="navigation"
      aria-label="Chat threads and navigation"
      aria-hidden={effectiveSidebarCollapsed}
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
    <main class="chat-main" role="main" aria-label="Chat conversation">
      <SwipeGesture
        on:swipeRight={handleSwipeRight}
        on:swipeLeft={handleSwipeLeft}
        disabled={!isMobile}
      >
        <div class="chat-container">
          {#if $currentThread}
            <!-- Chat Messages -->
            <div class="chat-messages" role="log" aria-label="Chat messages" aria-live="polite">
              <ChatPanel on:summarize={handleSummarizeChat} />
            </div>
          {:else}
            <!-- Welcome State -->
            <div class="welcome-state">
              <EnhancedGlass className="welcome-content-wrapper" borderRadius={24} padding="32px" elasticity={0}>
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
                      Experience powerful AI conversations with multiple models. Add your API keys in settings to get started.
                    {/if}
                  </p>
                  <div class="welcome-actions">
                    {#if $isAuthenticated}
                      <LiquidGlassButton
                        variant="secondary"
                        size="large"
                        onClick={() => showSettingsModal = true}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M12 1v6m0 6v6m-9 0h6m6 0h6M20.5 7.5L19 9l-1.5 1.5M7.5 20.5L9 19l1.5-1.5M3.5 7.5L5 9l1.5 1.5M16.5 20.5L15 19l-1.5-1.5"/>
                        </svg>
                        Manage API Keys
                      </LiquidGlassButton>
                    {:else}
                      <LiquidGlassButton
                        variant="primary"
                        size="large"
                        onClick={showAuthModalDialog}
                      >
                        Sign In to Get Started
                      </LiquidGlassButton>
                    {/if}
                  </div>
                  <div class="feature-grid">
                    <div class="feature-item">
                      <span class="feature-icon">🔑</span>
                      <span>BYOK Support</span>
                    </div>
                    <div class="feature-item">
                      <span class="feature-icon">🤖</span>
                      <span>Multiple AI Models</span>
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
          
          <!-- Message Input Always Visible -->
          <div class="message-input-container">
          <MessageInput 
            disabled={!$isAuthenticated}
            placeholder={$isAuthenticated 
              ? "Type a message..." 
              : "Sign in to start chatting..."
            }
              trinityMode={trinityModeEnabled}
              {trinityConfig}
              autoMemoryEnabled={autoMemoryEnabled}
          />
          </div>
        </div>
      </SwipeGesture>
    </main>
    
    <!-- Memory Cards Drawer -->
    {#if showMemoryCards}
      <div class="memory-drawer-backdrop" on:click={() => showMemoryCards = false} transition:fade={{ duration: 200 }}>
        <div class="memory-drawer" on:click|stopPropagation transition:fly={{ y: 500, duration: 300, easing: quintOut }}>
          <!-- Drag Handle -->
          <div class="drawer-handle-area">
            <div class="drawer-handle"></div>
          </div>
          
          <!-- Header -->
          <div class="memory-header">
            <div class="memory-header-content">
              <div class="memory-icon-wrapper">
                <span class="memory-icon">🧠</span>
                <div class="memory-icon-glow"></div>
              </div>
              <div class="memory-header-text">
                <h2 class="memory-title">Memory Graph</h2>
                <p class="memory-subtitle">Neural knowledge network across all conversations</p>
              </div>
            </div>
            
            <div class="memory-header-actions">
              <button 
                class="memory-action-btn {autoMemoryEnabled ? 'active' : ''}"
                on:click={() => autoMemoryEnabled = !autoMemoryEnabled}
                title="{autoMemoryEnabled ? 'Disable' : 'Enable'} automatic memory creation"
              >
                <span class="action-icon">{autoMemoryEnabled ? '⚡' : '💤'}</span>
                <span class="action-label">Auto-Build</span>
                <div class="action-status {autoMemoryEnabled ? 'on' : 'off'}"></div>
              </button>
              
              <button 
                class="memory-close-btn"
                on:click={() => showMemoryCards = false}
                title="Close Memory Drawer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Content -->
          <div class="memory-content">
            <MemoryCardList 
              compact={false} 
              showSearch={true}
              bind:autoMemoryEnabled
            />
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Settings Modal -->
  {#if showSettingsModal && $isAuthenticated}
    <div 
      class="settings-overlay liquid-glass-backdrop" 
      on:click={() => showSettingsModal = false}
      on:keydown={(e) => e.key === 'Escape' && (showSettingsModal = false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabindex="-1"
    >
      <div 
        class="settings-modal liquid-glass-modal liquid-glass-depth" 
        on:click|stopPropagation
        on:keydown={(e) => e.key === 'Escape' && (showSettingsModal = false)}
        role="document"
      >
        <div class="liquid-glass-layer"></div>
        <div class="settings-modal-content">
          <div class="settings-header">
            <h2 id="settings-title">Settings</h2>
            <button 
              class="close-button liquid-glass-button liquid-glass-focus" 
              on:click={() => showSettingsModal = false} 
              aria-label="Close settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          
          <div class="settings-tabs">
            <button 
              class="tab-button liquid-glass-button {settingsView === 'apikeys' ? 'active' : ''}"
              on:click={() => settingsView = 'apikeys'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
              API Keys
            </button>
            <button 
              class="tab-button liquid-glass-button {settingsView === 'profile' ? 'active' : ''}"
              on:click={() => settingsView = 'profile'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Profile
            </button>
          </div>
          
          <div class="settings-body">
            {#if settingsView === 'apikeys'}
              <ApiKeysManager />
            {:else}
              <div class="profile-section">
                <p>Profile settings coming soon...</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

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

  <!-- Trinity Config Modal -->
  <TrinityConfig 
    show={showTrinityConfig}
    config={trinityConfig}
    on:save={(e) => {
      trinityConfig = e.detail;
      trinityModeEnabled = true;
      showTrinityConfig = false;
      showToast('Trinity Mode configured and enabled', 'success');
    }}
    on:close={() => showTrinityConfig = false}
  />

  <!-- Toast Notification -->
  {#if toastMessage}
    <ToastNotification
      message={toastMessage}
      type={toastType}
      on:close={() => toastMessage = ''}
    />
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
  
  .header-action-btn {
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    height: 40px;
  }
  
  .header-action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 1);
    transform: translateY(-1px);
  }
  
  .header-action-btn.active {
    background: rgba(102, 126, 234, 0.2);
    border-color: rgba(102, 126, 234, 0.4);
    color: rgba(255, 255, 255, 1);
  }
  
  .sidebar-toggle {
    padding: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.9);
    transition: all 0.2s ease;
  }
  
  .sidebar-toggle:hover {
    color: rgba(255, 255, 255, 1);
    transform: scale(1.05);
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
    position: relative;
  }
  
  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
  }
  
  .chat-messages {
    flex: 1;
    overflow: hidden;
    padding: 0;
  }
  
  /* Welcome State */
  .welcome-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    overflow-y: auto;
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
    gap: 16px;
    margin-top: 32px;
    padding-top: 32px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .feature-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    border-radius: 16px;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.05)
    );
    backdrop-filter: blur(16px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
  
  .feature-item:hover {
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.08)
    );
    transform: translateY(-2px);
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
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
    .chat-ui {
      /* Enable focus for keyboard navigation */
      outline: none;
    }
    
    .chat-header {
      padding: 8px 12px;
      min-height: 56px; /* Slightly smaller for mobile */
    }
    
    .header-left {
      gap: 8px;
    }
    
    .header-right {
      gap: 8px;
    }
    
    .sidebar-toggle {
      padding: 12px; /* Larger touch target */
      min-width: 44px;
      min-height: 44px;
    }
    
    .thread-title {
      font-size: 16px;
    }
    
    .sidebar {
      position: fixed;
      top: 56px; /* Match mobile header height */
      left: 0;
      bottom: 0;
      width: 280px; /* Slightly smaller for mobile */
      transform: translateX(-100%);
      z-index: 200;
      /* Safe area support */
      padding-left: env(safe-area-inset-left);
      /* Smooth animations */
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .sidebar.mobile-open {
      transform: translateX(0);
      /* Add shadow for mobile overlay */
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
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
      /* Add touch-friendly padding */
      padding-right: env(safe-area-inset-right);
    }
    
    .chat-messages {
      /* Better scrolling on mobile */
      -webkit-overflow-scrolling: touch;
    }
    
    .chat-input {
      padding: 12px;
      /* Safe area padding for mobile keyboards */
      padding-bottom: max(12px, env(safe-area-inset-bottom));
    }
    
    .welcome-state {
      padding: 16px;
      /* Adjust for mobile spacing */
      min-height: calc(100vh - 56px - env(safe-area-inset-bottom));
    }
    
    .welcome-icon {
      font-size: 60px; /* Smaller for mobile */
    }
    
    .welcome-actions {
      margin-bottom: 32px; /* Reduced spacing */
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
  
  /* Small mobile devices (phones in portrait) */
  @media (max-width: 480px) {
    .chat-header {
      padding: 6px 8px;
      min-height: 52px;
    }
    
    .sidebar-toggle {
      padding: 10px;
      min-width: 40px;
      min-height: 40px;
    }
    
    .sidebar {
      width: min(280px, calc(100vw - 40px)); /* Don't take full width */
      top: 52px;
    }
    
    .thread-title {
      font-size: 15px;
    }
    
    .welcome-title {
      font-size: 20px;
    }
    
    .welcome-description {
      font-size: 14px;
      padding: 0 8px;
    }
    
    .welcome-icon {
      font-size: 48px;
    }
    
    .feature-grid {
      gap: 12px;
      margin-top: 32px;
      padding-top: 32px;
    }
    
    .feature-item {
      padding: 16px 12px;
    }
    
    .chat-input {
      padding: 8px;
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }
    
    .auth-modal {
      margin: 12px;
      width: calc(100% - 24px);
      max-height: 85vh;
    }
    
    .auth-modal-content {
      padding: 20px;
    }
  }
  
  /* Landscape mobile devices */
  @media (max-width: 768px) and (orientation: landscape) {
    .chat-header {
      min-height: 48px;
      padding: 4px 12px;
    }
    
    .sidebar {
      top: 48px;
      width: 240px; /* Narrower in landscape */
    }
    
    .welcome-state {
      padding: 12px;
    }
    
    .welcome-icon {
      font-size: 40px;
    }
    
    .welcome-title {
      font-size: 18px;
      margin-bottom: 8px;
    }
    
    .welcome-description {
      font-size: 13px;
      margin-bottom: 24px;
    }
    
    .feature-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 24px;
      padding-top: 24px;
    }
    
    .feature-item {
      padding: 12px 8px;
      font-size: 12px;
    }
    
    .welcome-actions {
      margin-bottom: 24px;
    }
  }
  
  /* Chat Container */
  .chat-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    background: transparent;
  }
  
  /* Settings Modal */
  .settings-overlay {
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
    padding: 20px;
  }
  
  .settings-modal {
    max-width: 900px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
    position: relative;
    margin: auto;
    overflow: hidden;
  }
  
  .settings-modal-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    z-index: 1;
    overflow: hidden;
  }
  
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 32px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .settings-header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
  
  .settings-tabs {
    display: flex;
    gap: 8px;
    padding: 16px 32px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .tab-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .tab-button.active {
    background: rgba(33, 150, 243, 0.1);
    color: #2196f3;
  }
  
  .settings-body {
    flex: 1;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.02);
    padding: 0;
    min-height: 0;
  }
  
  .profile-section {
    padding: 48px;
    text-align: center;
    color: rgba(0, 0, 0, 0.6);
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
    
    .settings-header {
      border-bottom-color: rgba(255, 255, 255, 0.1);
    }
    
    .settings-tabs {
      border-bottom-color: rgba(255, 255, 255, 0.1);
    }
    
    .settings-body {
      background: rgba(255, 255, 255, 0.02);
    }
    
    .profile-section {
      color: rgba(255, 255, 255, 0.6);
    }
  }
  
  /* Mobile settings modal */
  @media (max-width: 768px) {
    .settings-modal {
      width: 100%;
      max-width: 100%;
      height: 100%;
      max-height: 100%;
      border-radius: 0;
    }
    
    .settings-header {
      padding: 16px 20px;
    }
    
    .settings-tabs {
      padding: 12px 20px;
    }
    
    .tab-button {
      font-size: 13px;
      padding: 8px 16px;
    }
  }

  .message-input-container {
    flex-shrink: 0;
    position: relative;
    z-index: 10;
  }
  
  /* Memory Cards Drawer - Complete Redesign */
  .memory-drawer-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  
  .memory-drawer {
    width: 100%;
    max-width: 900px;
    height: 85vh;
    margin: 0 16px 16px;
    background: linear-gradient(
      135deg,
      rgba(15, 15, 25, 0.95) 0%,
      rgba(25, 25, 40, 0.95) 100%
    );
    backdrop-filter: blur(20px) saturate(180%);
    border-radius: 24px 24px 0 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 -10px 40px rgba(0, 0, 0, 0.4),
      0 -2px 10px rgba(102, 126, 234, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }
  
  .memory-drawer::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: radial-gradient(
      ellipse at top center,
      rgba(102, 126, 234, 0.15) 0%,
      transparent 70%
    );
    pointer-events: none;
  }
  
  /* Drag Handle */
  .drawer-handle-area {
    position: relative;
    padding: 16px;
    cursor: grab;
    display: flex;
    justify-content: center;
    z-index: 1;
  }
  
  .drawer-handle-area:active {
    cursor: grabbing;
  }
  
  .drawer-handle {
    width: 48px;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  
  .drawer-handle::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(102, 126, 234, 0.4) 50%,
      transparent 100%
    );
    animation: shimmer 2s infinite;
  }
  
  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }
  
  .drawer-handle-area:hover .drawer-handle {
    width: 64px;
    background: rgba(255, 255, 255, 0.3);
  }
  
  /* Header Section */
  .memory-header {
    position: relative;
    padding: 32px 32px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(
      180deg,
      rgba(102, 126, 234, 0.05) 0%,
      transparent 100%
    );
    z-index: 1;
  }
  
  .memory-header-content {
    display: flex;
    align-items: flex-start;
    gap: 24px;
  }
  
  .memory-icon-wrapper {
    position: relative;
    flex-shrink: 0;
  }
  
  .memory-icon {
    font-size: 48px;
    display: block;
    filter: drop-shadow(0 4px 20px rgba(102, 126, 234, 0.4));
    animation: float 6s ease-in-out infinite;
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-8px) rotate(5deg); }
  }
  
  .memory-icon-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 80px;
    height: 80px;
    transform: translate(-50%, -50%);
    background: radial-gradient(
      circle,
      rgba(102, 126, 234, 0.3) 0%,
      transparent 70%
    );
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
  
  .memory-header-text {
    flex: 1;
    min-width: 0;
  }
  
  .memory-title {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    letter-spacing: -0.5px;
    line-height: 1.2;
  }
  
  .memory-subtitle {
    margin: 8px 0 0;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.4;
  }
  
  /* Header Actions */
  .memory-header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }
  
  .memory-action-btn {
    position: relative;
    padding: 12px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }
  
  .memory-action-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      transparent 0%,
      rgba(102, 126, 234, 0.1) 100%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .memory-action-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
  }
  
  .memory-action-btn:hover::before {
    opacity: 1;
  }
  
  .memory-action-btn.active {
    background: rgba(102, 126, 234, 0.15);
    border-color: rgba(102, 126, 234, 0.3);
    color: rgba(255, 255, 255, 0.95);
  }
  
  .memory-action-btn.active .action-icon {
    animation: pulse-icon 2s ease-in-out infinite;
  }
  
  @keyframes pulse-icon {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
  
  .action-icon {
    font-size: 20px;
    position: relative;
    z-index: 1;
  }
  
  .action-label {
    position: relative;
    z-index: 1;
  }
  
  .action-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .action-status.on {
    background: #67e8a3;
    box-shadow: 0 0 12px rgba(103, 232, 163, 0.6);
  }
  
  .action-status.on::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    background: #67e8a3;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
  
  @keyframes ping {
    75%, 100% {
      transform: translate(-50%, -50%) scale(2);
      opacity: 0;
    }
  }
  
  /* Close Button */
  .memory-close-btn {
    width: 44px;
    height: 44px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  
  .memory-close-btn::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    transition: all 0.3s ease;
  }
  
  .memory-close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
    transform: rotate(90deg);
  }
  
  .memory-close-btn:hover::before {
    width: 100%;
    height: 100%;
  }
  
  /* Content Area */
  .memory-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 24px;
    position: relative;
    z-index: 1;
  }
  
  /* Scrollbar Styling */
  .memory-content::-webkit-scrollbar {
    width: 6px;
  }
  
  .memory-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  
  .memory-content::-webkit-scrollbar-thumb {
    background: rgba(102, 126, 234, 0.3);
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  
  .memory-content::-webkit-scrollbar-thumb:hover {
    background: rgba(102, 126, 234, 0.5);
  }
  
  /* Mobile Responsive */
  @media (max-width: 768px) {
    .memory-drawer {
      max-width: 100%;
      margin: 0;
      height: 90vh;
      border-radius: 24px 24px 0 0;
    }
    
    .memory-header {
      padding: 24px 20px 20px;
    }
    
    .memory-header-content {
      flex-direction: column;
      gap: 16px;
    }
    
    .memory-title {
      font-size: 24px;
    }
    
    .memory-subtitle {
      font-size: 14px;
    }
    
    .memory-content {
      padding: 20px;
    }
  }
</style> 