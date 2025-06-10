import { writable, type Writable } from 'svelte/store';

// Check if we're in a browser environment
const browser = typeof window !== 'undefined';

// Preferences interface
export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  showSidebar: boolean;
  defaultModel: string;
  defaultProvider: string;
  autoSave: boolean;
  soundEnabled: boolean;
  notifications: boolean;
  messageHistory: number; // Number of messages to keep in memory
}

// Default preferences
const defaultPreferences: AppPreferences = {
  theme: 'system',
  compactMode: false,
  showSidebar: true,
  defaultModel: 'gpt-4o',
  defaultProvider: 'openai',
  autoSave: true,
  soundEnabled: false,
  notifications: true,
  messageHistory: 100,
};

// Create a custom store with localStorage persistence
function createPersistedStore<T>(key: string, defaultValue: T): Writable<T> {
  // Initialize with default value
  let initialValue = defaultValue;

  // Load from localStorage if in browser
  if (browser) {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        initialValue = { ...defaultValue, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
    }
  }

  // Create the store
  const store = writable<T>(initialValue);

  // Subscribe to changes and save to localStorage
  if (browser) {
    store.subscribe((value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.warn(`Failed to save ${key} to localStorage:`, error);
      }
    });
  }

  return store;
}

// Preferences store with persistence
export const preferences = createPersistedStore<AppPreferences>('trichat-preferences', defaultPreferences);

// UI state stores (not persisted, session-only)
export const sidebarCollapsed = writable<boolean>(false);
export const isSettingsOpen = writable<boolean>(false);
export const isProfileOpen = writable<boolean>(false);
export const currentView = writable<'chat' | 'settings' | 'profile'>('chat');

// Theme-related derived stores and actions
export const themeActions = {
  setTheme(theme: AppPreferences['theme']): void {
    preferences.update(prefs => ({ ...prefs, theme }));
    themeActions.applyTheme(theme);
  },

  applyTheme(theme: AppPreferences['theme']): void {
    if (!browser) return;

    const root = document.documentElement;
    
    if (theme === 'system') {
      // Use system preference
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  },

  initializeTheme(): void {
    if (!browser) return;

    preferences.subscribe(prefs => {
      themeActions.applyTheme(prefs.theme);
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      preferences.subscribe(prefs => {
        if (prefs.theme === 'system') {
          document.documentElement.classList.toggle('dark', e.matches);
        }
      })();
    });
  },
};

// Model and provider preferences
export const modelActions = {
  setDefaultModel(model: string): void {
    preferences.update(prefs => ({ ...prefs, defaultModel: model }));
  },

  setDefaultProvider(provider: string): void {
    preferences.update(prefs => ({ ...prefs, defaultProvider: provider }));
  },

  getDefaults(): { model: string; provider: string } {
    let currentPrefs = defaultPreferences;
    preferences.subscribe(prefs => { currentPrefs = prefs; })();
    
    return {
      model: currentPrefs.defaultModel,
      provider: currentPrefs.defaultProvider,
    };
  },
};

// UI actions
export const uiActions = {
  toggleSidebar(): void {
    preferences.update(prefs => ({ ...prefs, showSidebar: !prefs.showSidebar }));
  },

  collapseSidebar(): void {
    sidebarCollapsed.set(true);
  },

  expandSidebar(): void {
    sidebarCollapsed.set(false);
  },

  toggleCompactMode(): void {
    preferences.update(prefs => ({ ...prefs, compactMode: !prefs.compactMode }));
  },

  openSettings(): void {
    isSettingsOpen.set(true);
    currentView.set('settings');
  },

  closeSettings(): void {
    isSettingsOpen.set(false);
    currentView.set('chat');
  },

  openProfile(): void {
    isProfileOpen.set(true);
    currentView.set('profile');
  },

  closeProfile(): void {
    isProfileOpen.set(false);
    currentView.set('chat');
  },

  resetPreferences(): void {
    preferences.set(defaultPreferences);
  },
};

// Initialize theme on module load
if (browser) {
  themeActions.initializeTheme();
}

// Export individual preference accessors for convenience
export const getPreference = <K extends keyof AppPreferences>(key: K): AppPreferences[K] => {
  let value = defaultPreferences[key];
  preferences.subscribe(prefs => { value = prefs[key]; })();
  return value;
};

export const setPreference = <K extends keyof AppPreferences>(
  key: K, 
  value: AppPreferences[K]
): void => {
  preferences.update(prefs => ({ ...prefs, [key]: value }));
}; 