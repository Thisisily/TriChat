import { writable, derived, type Readable } from 'svelte/store';
import { trpc } from '../trpc';
import { isAuthenticated } from './auth';

// Thread interface matching backend data
export interface Thread {
  id: string;
  title: string;
  userId: string;
  isPublic: boolean;
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount?: number;
  lastMessage?: {
    content: string;
    createdAt: Date;
    role: 'user' | 'assistant';
  };
}

// Message interface matching backend data
export interface Message {
  id: string;
  threadId: string;
  userId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  model?: string | null;
  provider?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  user?: {
    id: string;
    email: string;
    username: string | null;
  };
}

// Chat stores
export const threads = writable<Thread[]>([]);
export const currentThread = writable<Thread | null>(null);
export const currentMessages = writable<Message[]>([]);

// Loading states
export const threadsLoading = writable<boolean>(false);
export const messagesLoading = writable<boolean>(false);
export const sendingMessage = writable<boolean>(false);

// Error states
export const threadsError = writable<string | null>(null);
export const messagesError = writable<string | null>(null);

// Pagination state
export const messagesCursor = writable<string | undefined>(undefined);
export const hasMoreMessages = writable<boolean>(false);

// Derived stores
export const sortedThreads: Readable<Thread[]> = derived(
  threads,
  ($threads) => $threads.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
);

export const currentThreadId: Readable<string | null> = derived(
  currentThread,
  ($currentThread) => $currentThread?.id || null
);

export const isThreadSelected: Readable<boolean> = derived(
  currentThread,
  ($currentThread) => !!$currentThread
);

// Actions for thread management
export const threadActions = {
  // Load user's threads
  async loadThreads(): Promise<void> {
    try {
      threadsLoading.set(true);
      threadsError.set(null);
      
      const result = await trpc.chat.getThreads.query({
        limit: 50,
      });
      
      threads.set(result.threads);
    } catch (error) {
      console.error('Failed to load threads:', error);
      threadsError.set(error instanceof Error ? error.message : 'Failed to load threads');
    } finally {
      threadsLoading.set(false);
    }
  },

  // Create a new thread
  async createThread(title: string, isPublic = false): Promise<Thread> {
    try {
      threadsLoading.set(true);
      threadsError.set(null);
      
      const result = await trpc.chat.createThread.mutate({
        title,
        isPublic,
      });
      
      // Add the new thread to the list
      threads.update(current => [result.thread, ...current]);
      
      return result.thread;
    } catch (error) {
      console.error('Failed to create thread:', error);
      threadsError.set(error instanceof Error ? error.message : 'Failed to create thread');
      throw error;
    } finally {
      threadsLoading.set(false);
    }
  },

  // Select a thread and load its messages
  async selectThread(thread: Thread): Promise<void> {
    currentThread.set(thread);
    await messageActions.loadMessages(thread.id);
  },

  // Clear current thread selection
  clearThread(): void {
    currentThread.set(null);
    currentMessages.set([]);
    messagesCursor.set(undefined);
    hasMoreMessages.set(false);
    messagesError.set(null);
  },

  // Clear all thread data (on sign out)
  clear(): void {
    threads.set([]);
    threadActions.clearThread();
    threadsError.set(null);
    threadsLoading.set(false);
  },
};

// Actions for message management
export const messageActions = {
  // Load messages for a thread
  async loadMessages(threadId: string, cursor?: string): Promise<void> {
    try {
      messagesLoading.set(true);
      messagesError.set(null);
      
      const result = await trpc.chat.getMessages.query({
        threadId,
        limit: 50,
        cursor,
      });
      
      if (cursor) {
        // Append to existing messages (pagination)
        currentMessages.update(current => [...current, ...result.messages]);
      } else {
        // Replace messages (initial load)
        currentMessages.set(result.messages);
      }
      
      messagesCursor.set(result.nextCursor);
      hasMoreMessages.set(!!result.nextCursor);
    } catch (error) {
      console.error('Failed to load messages:', error);
      messagesError.set(error instanceof Error ? error.message : 'Failed to load messages');
    } finally {
      messagesLoading.set(false);
    }
  },

  // Load more messages (pagination)
  async loadMoreMessages(): Promise<void> {
    const $currentThread = currentThread;
    const $cursor = messagesCursor;
    
    let threadId: string | null = null;
    let cursor: string | undefined = undefined;
    
    $currentThread.subscribe(value => { threadId = value?.id || null; })();
    $cursor.subscribe(value => { cursor = value; })();
    
    if (threadId && cursor) {
      await messageActions.loadMessages(threadId, cursor);
    }
  },

  // Send a message
  async sendMessage(content: string, model: string, provider: string): Promise<void> {
    const $currentThread = currentThread;
    let threadId: string | null = null;
    $currentThread.subscribe(value => { threadId = value?.id || null; })();
    
    if (!threadId) {
      throw new Error('No thread selected');
    }

    try {
      sendingMessage.set(true);
      messagesError.set(null);
      
      const result = await trpc.chat.sendMessage.mutate({
        threadId,
        content,
        model,
        provider: provider as 'openai' | 'anthropic' | 'google' | 'mistral' | 'openrouter',
      });
      
      // Add both user and assistant messages to the current messages
      currentMessages.update(current => [
        ...current,
        result.userMessage,
        result.assistantMessage,
      ]);
      
      // Update the thread's last activity
      threads.update(current => 
        current.map(thread => 
          thread.id === threadId 
            ? { ...thread, updatedAt: new Date() }
            : thread
        )
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      messagesError.set(error instanceof Error ? error.message : 'Failed to send message');
      throw error;
    } finally {
      sendingMessage.set(false);
    }
  },

  // Clear messages
  clear(): void {
    currentMessages.set([]);
    messagesCursor.set(undefined);
    hasMoreMessages.set(false);
    messagesError.set(null);
    messagesLoading.set(false);
    sendingMessage.set(false);
  },
};

// Auto-load threads when user becomes authenticated
isAuthenticated.subscribe(async ($isAuthenticated) => {
  if ($isAuthenticated) {
    await threadActions.loadThreads();
  } else {
    threadActions.clear();
  }
}); 