import { writable, derived, type Readable } from 'svelte/store';
import { Clerk } from '@clerk/clerk-js';
import { streamingActions } from '../streaming';

// Types for user data
export interface User {
  id: string;
  email: string;
  username: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string;
}

export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
  sessionToken: string | null;
}

// Initial auth state
const initialState: AuthState = {
  isLoaded: false,
  isSignedIn: false,
  user: null,
  sessionToken: null,
};

// Create auth store
export const authStore = writable<AuthState>(initialState);

// Clerk instance (will be initialized)
let clerkInstance: Clerk | null = null;

// Initialize Clerk
export async function initializeClerk(): Promise<void> {
  try {
    const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      throw new Error('VITE_CLERK_PUBLISHABLE_KEY is required');
    }

    // Initialize Clerk instance
    clerkInstance = new Clerk(publishableKey);
    
    await clerkInstance.load({
      // Configure Clerk options
      standardBrowser: true,
    });

    // Listen for auth state changes
    clerkInstance.addListener(async ({ user, session }) => {
      // Get session token asynchronously
      let sessionToken: string | null = null;
      if (session) {
        try {
          // Use default template since 'integration_default' doesn't exist yet
          sessionToken = await session.getToken();
        } catch (error) {
          console.error('Failed to get session token:', error);
        }
      }

      const authData: AuthState = {
        isLoaded: true,
        isSignedIn: !!user,
        user: user ? {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
        } : null,
        sessionToken,
      };

      authStore.set(authData);

      // Connect/disconnect streaming based on auth state
      if (user && sessionToken) {
        console.log('User signed in, connecting to streaming service...');
        try {
          await streamingActions.connect();
        } catch (error) {
          console.error('Failed to connect streaming service:', error);
        }
      } else {
        console.log('User signed out, disconnecting from streaming service...');
        streamingActions.disconnect();
      }
    });

    console.log('Clerk initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Clerk:', error);
    authStore.set({
      isLoaded: true,
      isSignedIn: false,
      user: null,
      sessionToken: null,
    });
  }
}

// Sign in with redirect
export async function signIn(): Promise<void> {
  if (!clerkInstance) {
    throw new Error('Clerk not initialized');
  }

  try {
    await clerkInstance.redirectToSignIn({
      redirectUrl: window.location.origin,
    });
  } catch (error) {
    console.error('Sign in failed:', error);
    throw error;
  }
}

// Sign up with redirect
export async function signUp(): Promise<void> {
  if (!clerkInstance) {
    throw new Error('Clerk not initialized');
  }

  try {
    await clerkInstance.redirectToSignUp({
      redirectUrl: window.location.origin,
    });
  } catch (error) {
    console.error('Sign up failed:', error);
    throw error;
  }
}

// Sign out
export async function signOut(): Promise<void> {
  if (!clerkInstance) {
    throw new Error('Clerk not initialized');
  }

  try {
    // Disconnect streaming before signing out
    streamingActions.disconnect();
    
    await clerkInstance.signOut();
    authStore.set(initialState);
  } catch (error) {
    console.error('Sign out failed:', error);
    throw error;
  }
}

// Get current session token
export async function getSessionToken(): Promise<string | null> {
  if (!clerkInstance?.session) {
    return null;
  }

  try {
    // Use default template since 'integration_default' doesn't exist yet
    return await clerkInstance.session.getToken();
  } catch (error) {
    console.error('Failed to get session token:', error);
    return null;
  }
}

// Derived stores for convenience
export const isAuthenticated: Readable<boolean> = derived(
  authStore,
  ($auth) => $auth.isSignedIn
);

export const currentUser: Readable<User | null> = derived(
  authStore,
  ($auth) => $auth.user
);

export const isLoading: Readable<boolean> = derived(
  authStore,
  ($auth) => !$auth.isLoaded
); 