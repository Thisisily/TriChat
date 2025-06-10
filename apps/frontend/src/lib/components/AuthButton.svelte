<script lang="ts">
  import { isAuthenticated, currentUser, signIn, signUp, signOut } from '../stores/auth';
  
  let showSignUp = false;
  
  async function handleSignIn() {
    try {
      await signIn();
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  }
  
  async function handleSignUp() {
    try {
      await signUp();
    } catch (error) {
      console.error('Sign up failed:', error);
    }
  }
  
  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }
</script>

{#if $isAuthenticated && $currentUser}
  <div class="auth-container authenticated">
    <div class="user-info">
      {#if $currentUser.imageUrl}
        <img src={$currentUser.imageUrl} alt="Profile" class="avatar" />
      {/if}
      <span class="user-name">
        {$currentUser.firstName || $currentUser.username || $currentUser.email}
      </span>
    </div>
    <button class="btn btn-outline" on:click={handleSignOut}>
      Sign Out
    </button>
  </div>
{:else}
  <div class="auth-container unauthenticated">
    {#if showSignUp}
      <button class="btn btn-secondary" on:click={() => showSignUp = false}>
        Back to Sign In
      </button>
      <button class="btn btn-primary" on:click={handleSignUp}>
        Sign Up
      </button>
    {:else}
      <button class="btn btn-secondary" on:click={() => showSignUp = true}>
        Sign Up
      </button>
      <button class="btn btn-primary" on:click={handleSignIn}>
        Sign In
      </button>
    {/if}
  </div>
{/if}

<style>
  .auth-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .user-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .user-name {
    font-weight: 500;
    color: var(--text-primary, #333);
  }
  
  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    background: none;
    font-size: 14px;
  }
  
  .btn-primary {
    background: #2563eb;
    color: white;
    border-color: #2563eb;
  }
  
  .btn-primary:hover {
    background: #1d4ed8;
    border-color: #1d4ed8;
  }
  
  .btn-secondary {
    color: #6b7280;
    border-color: #d1d5db;
  }
  
  .btn-secondary:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }
  
  .btn-outline {
    color: #374151;
    border-color: #d1d5db;
  }
  
  .btn-outline:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }
</style> 