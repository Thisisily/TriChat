// Authentication stores
export {
  authStore,
  initializeClerk,
  signIn,
  signUp,
  signOut,
  getSessionToken,
  isAuthenticated,
  currentUser,
  isLoading,
  type User,
  type AuthState,
} from './auth';

// User profile stores
export {
  userProfile,
  userLoading,
  userError,
  fullUserData,
  userActions,
  type UserProfile,
  type UserApiKey,
} from './user';

// Thread and message stores
export {
  threads,
  currentThread,
  currentMessages,
  threadsLoading,
  messagesLoading,
  sendingMessage,
  threadsError,
  messagesError,
  messagesCursor,
  hasMoreMessages,
  sortedThreads,
  currentThreadId,
  isThreadSelected,
  threadActions,
  messageActions,
  type Thread,
  type Message,
} from './threads';

// Preferences and UI stores
export {
  preferences,
  sidebarCollapsed,
  isSettingsOpen,
  isProfileOpen,
  currentView,
  themeActions,
  modelActions,
  uiActions,
  getPreference,
  setPreference,
  type AppPreferences,
} from './preferences';

// Import actions for the combined object
import { 
  initializeClerk as initClerk,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut
} from './auth';
import { userActions } from './user';
import { threadActions, messageActions } from './threads';
import { themeActions, modelActions, uiActions } from './preferences';

// Combined actions object for convenience
export const actions = {
  auth: {
    signIn: authSignIn,
    signUp: authSignUp,
    signOut: authSignOut,
    initializeClerk: initClerk,
  },
  user: userActions,
  threads: threadActions,
  messages: messageActions,
  theme: themeActions,
  models: modelActions,
  ui: uiActions,
}; 