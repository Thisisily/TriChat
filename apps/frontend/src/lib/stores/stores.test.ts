import { describe, it, expect, beforeEach } from 'bun:test';
import { get } from 'svelte/store';
import { preferences, uiActions } from './preferences';
import { threads, currentThread, threadActions } from './threads';

describe('Preferences Store', () => {
  beforeEach(() => {
    // Reset preferences before each test
    uiActions.resetPreferences();
  });

  it('should have default preferences', () => {
    const prefs = get(preferences);
    expect(prefs.theme).toBe('system');
    expect(prefs.showSidebar).toBe(true);
    expect(prefs.defaultModel).toBe('gpt-4o');
  });

  it('should update theme preference', () => {
    uiActions.resetPreferences();
    
    preferences.update(prefs => ({ ...prefs, theme: 'dark' }));
    
    const updatedPrefs = get(preferences);
    expect(updatedPrefs.theme).toBe('dark');
  });

  it('should toggle sidebar preference', () => {
    const initialPrefs = get(preferences);
    const initialSidebar = initialPrefs.showSidebar;
    
    uiActions.toggleSidebar();
    
    const updatedPrefs = get(preferences);
    expect(updatedPrefs.showSidebar).toBe(!initialSidebar);
  });
});

describe('Threads Store', () => {
  beforeEach(() => {
    // Clear threads before each test
    threadActions.clear();
  });

  it('should start with empty threads', () => {
    const threadsData = get(threads);
    expect(threadsData).toHaveLength(0);
  });

  it('should have no current thread initially', () => {
    const current = get(currentThread);
    expect(current).toBeNull();
  });

  it('should clear thread selection', () => {
    // Manually set a current thread
    currentThread.set({
      id: 'test-thread',
      title: 'Test Thread',
      userId: 'test-user',
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(get(currentThread)).not.toBeNull();

    threadActions.clearThread();

    expect(get(currentThread)).toBeNull();
  });
});

describe('Store Integration', () => {
  it('should export all required stores from index', async () => {
    const storeModule = await import('./index');
    
    // Check that key exports exist
    expect(storeModule.preferences).toBeDefined();
    expect(storeModule.threads).toBeDefined();
    expect(storeModule.currentThread).toBeDefined();
    expect(storeModule.actions).toBeDefined();
    expect(storeModule.actions.ui).toBeDefined();
    expect(storeModule.actions.threads).toBeDefined();
  });
}); 