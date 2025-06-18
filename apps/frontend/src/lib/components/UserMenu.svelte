<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { 
    isAuthenticated, 
    currentUser, 
    signIn, 
    signOut,
    preferences,
    themeActions 
  } from '../stores';
  
  const dispatch = createEventDispatcher();
  
  let showDropdown = false;
  let showSettings = false;
  let dropdownElement: HTMLDivElement;
  
  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
      showDropdown = false;
    }
  }
  
  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
  
  function toggleDropdown() {
    showDropdown = !showDropdown;
  }
  
  function openSettings() {
    showSettings = true;
    showDropdown = false;
  }
  
  function closeSettings() {
    showSettings = false;
  }
  
  async function handleSignOut() {
    try {
      await signOut();
      showDropdown = false;
      dispatch('signedOut');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }
  
  async function handleSignIn() {
    try {
      await signIn();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  }
  
  function getInitials(user: any): string {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  }
  
  function getUserDisplayName(user: any): string {
    if (user?.firstName) {
      return user.firstName + (user.lastName ? ` ${user.lastName}` : '');
    }
    if (user?.username) {
      return user.username;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  }
</script>

{#if $isAuthenticated && $currentUser}
  <!-- Authenticated User Menu -->
  <div class="user-menu" bind:this={dropdownElement}>
    <button 
      class="user-avatar-button"
      on:click={toggleDropdown}
      aria-label="User menu"
      title="User menu"
    >
      {#if $currentUser.imageUrl}
        <img 
          src={$currentUser.imageUrl} 
          alt="Profile" 
          class="avatar-image"
        />
      {:else}
        <div class="avatar-fallback">
          {getInitials($currentUser)}
        </div>
      {/if}
    </button>
    
    {#if showDropdown}
      <div class="dropdown-menu">
        <!-- User Info -->
        <div class="user-info">
          <div class="user-details">
            <div class="user-name">{getUserDisplayName($currentUser)}</div>
            <div class="user-email">{$currentUser.email}</div>
          </div>
        </div>
        
        <div class="menu-divider"></div>
        
        <!-- Menu Items -->
        <button class="menu-item" on:click={() => { showDropdown = false; dispatch('openApiKeys'); }}>
          <span class="menu-icon">🔑</span>
          API Keys
        </button>
        
        <button class="menu-item" on:click={openSettings}>
          <span class="menu-icon">⚙️</span>
          Settings
        </button>
        
        <button class="menu-item" on:click={() => dispatch('openHelp')}>
          <span class="menu-icon">❓</span>
          Help & Support
        </button>
        
        <button class="menu-item" on:click={() => dispatch('openShortcuts')}>
          <span class="menu-icon">⌨️</span>
          Keyboard Shortcuts
        </button>
        
        <div class="menu-divider"></div>
        
        <button class="menu-item danger" on:click={handleSignOut}>
          <span class="menu-icon">🚪</span>
          Sign Out
        </button>
      </div>
    {/if}
  </div>
{:else}
  <!-- Sign In Button -->
  <button 
    class="sign-in-button"
    on:click={handleSignIn}
  >
    Sign In
  </button>
{/if}

  <!-- Settings Modal -->
  {#if showSettings}
    <div 
      class="modal-overlay" 
      on:click={(e) => {
        if (e.target === e.currentTarget) {
          closeSettings();
        }
      }}
      on:keydown={(e) => e.key === 'Escape' && closeSettings()}
      role="button"
      tabindex="-1"
      aria-label="Close settings modal"
    >
    <div class="modal-content">
      <div class="modal-header">
        <h2>Settings</h2>
        <button class="modal-close" on:click={closeSettings} aria-label="Close">
          ✕
        </button>
      </div>
      
      <div class="modal-body">
        <!-- Theme Settings -->
        <div class="setting-group">
          <h3>Appearance</h3>
          <div class="setting-item">
            <label for="theme-select">Theme</label>
            <select 
              id="theme-select"
              bind:value={$preferences.theme}
              on:change={(e) => themeActions.setTheme((e.target as HTMLSelectElement)?.value as 'light' | 'dark' | 'system')}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
          
          <div class="setting-item">
            <label class="checkbox-label">
              <input 
                type="checkbox"
                bind:checked={$preferences.compactMode}
              />
              Compact mode
            </label>
          </div>
        </div>
        
        <!-- Chat Settings -->
        <div class="setting-group">
          <h3>Chat Preferences</h3>
          <div class="setting-item">
            <label class="checkbox-label">
              <input 
                type="checkbox"
                bind:checked={$preferences.showSidebar}
              />
              Show sidebar by default
            </label>
          </div>
          
          <div class="setting-item">
            <label class="checkbox-label">
              <input 
                type="checkbox"
                bind:checked={$preferences.notifications}
              />
              Enable notifications
            </label>
          </div>
        </div>
        
        <!-- AI Model Settings -->
        <div class="setting-group">
          <h3>AI Models</h3>
          <div class="setting-item">
            <label for="default-model">Default Model</label>
            <select id="default-model" bind:value={$preferences.defaultModel}>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-3-opus">Claude 3 Opus</option>
              <option value="claude-3-sonnet">Claude 3 Sonnet</option>
            </select>
          </div>
        </div>
        
        <!-- API Keys Section -->
        <div class="setting-group">
          <h3>API Keys</h3>
          <p class="setting-description">
            Bring your own API keys for direct billing and usage.
          </p>
          <button class="btn btn-secondary" on:click={() => dispatch('manageApiKeys')}>
            Manage API Keys
          </button>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={closeSettings}>
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .user-menu {
    position: relative;
    display: inline-block;
  }
  
  .user-avatar-button {
    background: transparent;
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    padding: 2px;
    border-radius: 50%;
    transition: all 0.2s ease;
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .user-avatar-button:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  .avatar-image, .avatar-fallback {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .avatar-image {
    object-fit: cover;
  }
  
  .avatar-fallback {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-weight: 600;
    font-size: 14px;
  }
  
  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    min-width: 240px;
    z-index: 1000;
    animation: slideDown 0.2s ease;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .user-info {
    padding: 16px;
  }
  
  .user-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .user-name {
    font-weight: 600;
    color: #111827;
    font-size: 14px;
  }
  
  .user-email {
    font-size: 12px;
    color: #6b7280;
  }
  
  .menu-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 0 8px;
  }
  
  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    color: #374151;
    transition: background-color 0.15s ease;
  }
  
  .menu-item:hover {
    background: #f9fafb;
  }
  
  .menu-item.danger {
    color: #dc2626;
  }
  
  .menu-item.danger:hover {
    background: #fef2f2;
  }
  
  .menu-icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }
  
  .sign-in-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
  }
  
  .sign-in-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
  }
  
  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.2s ease;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .modal-content {
    background: white;
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
    animation: slideUp 0.3s ease;
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
  
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 24px 0;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #111827;
  }
  
  .modal-close {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: #6b7280;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.15s ease;
  }
  
  .modal-close:hover {
    color: #374151;
    background: #f3f4f6;
  }
  
  .modal-body {
    padding: 0 24px;
    max-height: 60vh;
    overflow-y: auto;
  }
  
  .modal-footer {
    padding: 16px 24px 24px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
  
  .setting-group {
    margin-bottom: 32px;
  }
  
  .setting-group h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }
  
  .setting-item {
    margin-bottom: 16px;
  }
  
  .setting-item label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 6px;
  }
  
  .setting-item select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    background: white;
    color: #374151;
  }
  
  .setting-item select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  
  .checkbox-label {
    display: flex !important;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin: 0 !important;
  }
  
  .checkbox-label input[type="checkbox"] {
    margin: 0;
  }
  
  .setting-description {
    font-size: 13px;
    color: #6b7280;
    margin: 8px 0 16px 0;
    line-height: 1.5;
  }
  
  .btn {
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    border: 1px solid;
  }
  
  .btn-secondary {
    background: white;
    color: #374151;
    border-color: #d1d5db;
  }
  
  .btn-secondary:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .dropdown-menu {
      background: #1f2937;
      border-color: #374151;
    }
    
    .user-name {
      color: #f9fafb;
    }
    
    .user-email {
      color: #9ca3af;
    }
    
    .menu-divider {
      background: #374151;
    }
    
    .menu-item {
      color: #d1d5db;
    }
    
    .menu-item:hover {
      background: #374151;
    }
    
    .menu-item.danger:hover {
      background: #7f1d1d;
    }
    
    .modal-content {
      background: #1f2937;
    }
    
    .modal-header {
      border-color: #374151;
    }
    
    .modal-header h2 {
      color: #f9fafb;
    }
    
    .modal-close {
      color: #9ca3af;
    }
    
    .modal-close:hover {
      color: #d1d5db;
      background: #374151;
    }
    
    .modal-footer {
      border-color: #374151;
    }
    
    .setting-group h3 {
      color: #f9fafb;
    }
    
    .setting-item label {
      color: #d1d5db;
    }
    
    .setting-item select {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }
    
    .setting-description {
      color: #9ca3af;
    }
    
    .btn-secondary {
      background: #374151;
      color: #d1d5db;
      border-color: #4b5563;
    }
    
    .btn-secondary:hover {
      background: #4b5563;
      border-color: #6b7280;
    }
  }
  
  /* Mobile responsive */
  @media (max-width: 640px) {
    .dropdown-menu {
      min-width: 200px;
      right: -8px;
    }
    
    .modal-content {
      width: 95%;
      margin: 20px;
    }
    
    .modal-header,
    .modal-body,
    .modal-footer {
      padding-left: 16px;
      padding-right: 16px;
    }
  }
</style> 