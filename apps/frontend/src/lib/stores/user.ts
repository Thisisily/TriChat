import { writable, derived, type Readable } from 'svelte/store';
import { currentUser, authStore } from './auth';
import { trpc } from '../trpc';

// User profile data (extended from auth)
export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string;
  apiKeys?: UserApiKey[];
  stats?: {
    threads: number;
    messages: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserApiKey {
  id: string;
  provider: string;
  keyName: string;
  createdAt: Date;
}

// Store for extended user profile data
export const userProfile = writable<UserProfile | null>(null);

// Loading state for user operations
export const userLoading = writable<boolean>(false);

// Error state for user operations  
export const userError = writable<string | null>(null);

// Derived store that combines auth user with extended profile
export const fullUserData: Readable<UserProfile | null> = derived(
  [currentUser, userProfile],
  ([$currentUser, $userProfile]) => {
    if (!$currentUser) return null;
    
    // Merge auth data with extended profile data
    return {
      ...$currentUser,
      ...$userProfile,
    } as UserProfile;
  }
);

// Actions for user management
export const userActions = {
  // Load full user profile from backend
  async loadProfile(): Promise<void> {
    try {
      userLoading.set(true);
      userError.set(null);
      
      const result = await trpc.auth.me.query();
      userProfile.set(result.user);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      userError.set(error instanceof Error ? error.message : 'Failed to load profile');
    } finally {
      userLoading.set(false);
    }
  },

  // Update user profile
  async updateProfile(updates: { username?: string }): Promise<void> {
    try {
      userLoading.set(true);
      userError.set(null);
      
      const result = await trpc.auth.updateProfile.mutate(updates);
      userProfile.set(result.user);
    } catch (error) {
      console.error('Failed to update profile:', error);
      userError.set(error instanceof Error ? error.message : 'Failed to update profile');
      throw error;
    } finally {
      userLoading.set(false);
    }
  },

  // Add API key
  async addApiKey(data: {
    provider: string;
    keyName: string;
    encryptedKey: string;
  }): Promise<void> {
    try {
      userLoading.set(true);
      userError.set(null);
      
      await trpc.auth.addApiKey.mutate(data as {
        provider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'openrouter';
        keyName: string;
        encryptedKey: string;
      });
      // Reload profile to get updated API keys
      await userActions.loadProfile();
    } catch (error) {
      console.error('Failed to add API key:', error);
      userError.set(error instanceof Error ? error.message : 'Failed to add API key');
      throw error;
    } finally {
      userLoading.set(false);
    }
  },

  // Remove API key
  async removeApiKey(apiKeyId: string): Promise<void> {
    try {
      userLoading.set(true);
      userError.set(null);
      
      await trpc.auth.removeApiKey.mutate({ apiKeyId });
      // Reload profile to get updated API keys
      await userActions.loadProfile();
    } catch (error) {
      console.error('Failed to remove API key:', error);
      userError.set(error instanceof Error ? error.message : 'Failed to remove API key');
      throw error;
    } finally {
      userLoading.set(false);
    }
  },

  // Clear user data (on sign out)
  clear(): void {
    userProfile.set(null);
    userError.set(null);
    userLoading.set(false);
  },
};

// Auto-load profile when user becomes authenticated
authStore.subscribe(async ($authState) => {
  if ($authState.isSignedIn && $authState.user) {
    // Only load if we don't already have profile data
    const currentProfile = userProfile;
    let hasProfile = false;
    currentProfile.subscribe(value => { hasProfile = !!value; })();
    
    if (!hasProfile) {
      await userActions.loadProfile();
    }
  } else {
    // Clear user data when signed out
    userActions.clear();
  }
}); 