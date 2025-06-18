import { prisma } from './database';

/**
 * Conflict resolution strategies
 */
export type ConflictResolutionStrategy = 
  | 'last-write-wins'
  | 'first-write-wins' 
  | 'merge-content'
  | 'user-prompt';

/**
 * Conflict detection result
 */
export interface ConflictResult {
  hasConflict: boolean;
  conflictType: 'version-mismatch' | 'concurrent-edit' | 'none';
  clientVersion: number;
  serverVersion: number;
  lastModified?: Date;
  conflictingFields?: string[];
}

/**
 * Conflict resolution options
 */
export interface ConflictResolutionOptions {
  strategy: ConflictResolutionStrategy;
  clientData: any;
  serverData: any;
  conflictInfo: ConflictResult;
  userId: string;
  mergePriority?: 'client' | 'server' | 'timestamp';
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  resolved: boolean;
  strategy: ConflictResolutionStrategy;
  resolvedData: any;
  requiresUserInput: boolean;
  conflictDetails?: {
    clientChanges: string[];
    serverChanges: string[];
    suggestedMerge?: any;
  };
  error?: string;
}

/**
 * Thread conflict detection and resolution
 */
export class ThreadConflictResolver {
  /**
   * Detect if a thread update has conflicts
   */
  static async detectConflict(
    threadId: string,
    clientVersion: number,
    userId: string
  ): Promise<ConflictResult> {
    try {
      // Get current thread from database
      const currentThread = await prisma.thread.findFirst({
        where: {
          id: threadId,
          userId: userId,
        },
        select: {
          version: true,
          updatedAt: true,
          title: true,
        },
      });

      if (!currentThread) {
        throw new Error('Thread not found');
      }

      // Check for version mismatch (optimistic locking)
      if (currentThread.version !== clientVersion) {
        return {
          hasConflict: true,
          conflictType: 'version-mismatch',
          clientVersion,
          serverVersion: currentThread.version,
          lastModified: currentThread.updatedAt,
          conflictingFields: ['title'], // Could be expanded based on what changed
        };
      }

      // Check for very recent concurrent edits (within 5 seconds)
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      if (currentThread.updatedAt > fiveSecondsAgo) {
        return {
          hasConflict: true,
          conflictType: 'concurrent-edit',
          clientVersion,
          serverVersion: currentThread.version,
          lastModified: currentThread.updatedAt,
        };
      }

      return {
        hasConflict: false,
        conflictType: 'none',
        clientVersion,
        serverVersion: currentThread.version,
      };
    } catch (error) {
      console.error('Error detecting thread conflict:', error);
      throw error;
    }
  }

  /**
   * Resolve thread conflicts based on strategy
   */
  static async resolveConflict(
    threadId: string,
    options: ConflictResolutionOptions
  ): Promise<ConflictResolutionResult> {
    const { strategy, clientData, serverData, conflictInfo, userId } = options;

    try {
      switch (strategy) {
        case 'last-write-wins':
          return this.resolveLastWriteWins(threadId, clientData, userId);

        case 'first-write-wins':
          return this.resolveFirstWriteWins(conflictInfo, serverData);

        case 'merge-content':
          return this.resolveMergeContent(threadId, clientData, serverData, userId);

        case 'user-prompt':
          return this.resolveUserPrompt(clientData, serverData, conflictInfo);

        default:
          throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
      }
    } catch (error) {
      console.error('Error resolving thread conflict:', error);
      return {
        resolved: false,
        strategy,
        resolvedData: null,
        requiresUserInput: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Last-write-wins strategy: Client data overwrites server data
   */
  private static async resolveLastWriteWins(
    threadId: string,
    clientData: any,
    userId: string
  ): Promise<ConflictResolutionResult> {
    // Get current version to increment
    const currentThread = await prisma.thread.findFirst({
      where: { id: threadId, userId },
      select: { version: true },
    });

    if (!currentThread) {
      throw new Error('Thread not found');
    }

    // Update with client data and increment version
    const updatedThread = await prisma.thread.update({
      where: { id: threadId },
      data: {
        ...clientData,
        version: currentThread.version + 1,
        updatedAt: new Date(),
      },
    });

    return {
      resolved: true,
      strategy: 'last-write-wins',
      resolvedData: updatedThread,
      requiresUserInput: false,
    };
  }

  /**
   * First-write-wins strategy: Server data is kept, client changes rejected
   */
  private static async resolveFirstWriteWins(
    conflictInfo: ConflictResult,
    serverData: any
  ): Promise<ConflictResolutionResult> {
    return {
      resolved: true,
      strategy: 'first-write-wins',
      resolvedData: serverData,
      requiresUserInput: false,
      conflictDetails: {
        clientChanges: ['Client changes rejected'],
        serverChanges: ['Server data preserved'],
      },
    };
  }

  /**
   * Merge-content strategy: Attempt to merge changes intelligently
   */
  private static async resolveMergeContent(
    threadId: string,
    clientData: any,
    serverData: any,
    userId: string
  ): Promise<ConflictResolutionResult> {
    // Simple merge logic for thread data
    const mergedData = {
      ...serverData,
      ...clientData,
      // For title conflicts, prefer non-empty values
      title: clientData.title?.trim() || serverData.title,
    };

    // Get current version to increment
    const currentThread = await prisma.thread.findFirst({
      where: { id: threadId, userId },
      select: { version: true },
    });

    if (!currentThread) {
      throw new Error('Thread not found');
    }

    // Update with merged data
    const updatedThread = await prisma.thread.update({
      where: { id: threadId },
      data: {
        ...mergedData,
        version: currentThread.version + 1,
        updatedAt: new Date(),
      },
    });

    return {
      resolved: true,
      strategy: 'merge-content',
      resolvedData: updatedThread,
      requiresUserInput: false,
      conflictDetails: {
        clientChanges: Object.keys(clientData),
        serverChanges: Object.keys(serverData),
        suggestedMerge: mergedData,
      },
    };
  }

  /**
   * User-prompt strategy: Require user input for resolution
   */
  private static async resolveUserPrompt(
    clientData: any,
    serverData: any,
    conflictInfo: ConflictResult
  ): Promise<ConflictResolutionResult> {
    return {
      resolved: false,
      strategy: 'user-prompt',
      resolvedData: null,
      requiresUserInput: true,
      conflictDetails: {
        clientChanges: Object.keys(clientData),
        serverChanges: Object.keys(serverData),
        suggestedMerge: {
          client: clientData,
          server: serverData,
          conflictFields: conflictInfo.conflictingFields,
        },
      },
    };
  }
}

/**
 * Message conflict detection and resolution
 */
export class MessageConflictResolver {
  /**
   * Detect if a message update has conflicts
   */
  static async detectConflict(
    messageId: string,
    clientVersion: number,
    userId: string
  ): Promise<ConflictResult> {
    try {
      // Get current message from database
      const currentMessage = await prisma.message.findFirst({
        where: {
          id: messageId,
          userId: userId,
        },
        select: {
          version: true,
          updatedAt: true,
          content: true,
        },
      });

      if (!currentMessage) {
        throw new Error('Message not found');
      }

      // Check for version mismatch
      if (currentMessage.version !== clientVersion) {
        return {
          hasConflict: true,
          conflictType: 'version-mismatch',
          clientVersion,
          serverVersion: currentMessage.version,
          lastModified: currentMessage.updatedAt,
          conflictingFields: ['content'],
        };
      }

      // Check for concurrent edits (within 10 seconds for messages)
      const tenSecondsAgo = new Date(Date.now() - 10000);
      if (currentMessage.updatedAt > tenSecondsAgo) {
        return {
          hasConflict: true,
          conflictType: 'concurrent-edit',
          clientVersion,
          serverVersion: currentMessage.version,
          lastModified: currentMessage.updatedAt,
        };
      }

      return {
        hasConflict: false,
        conflictType: 'none',
        clientVersion,
        serverVersion: currentMessage.version,
      };
    } catch (error) {
      console.error('Error detecting message conflict:', error);
      throw error;
    }
  }

  /**
   * Resolve message conflicts
   */
  static async resolveConflict(
    messageId: string,
    options: ConflictResolutionOptions
  ): Promise<ConflictResolutionResult> {
    const { strategy, clientData, serverData, userId } = options;

    try {
      switch (strategy) {
        case 'last-write-wins':
          return this.resolveLastWriteWins(messageId, clientData, userId);

        case 'first-write-wins':
          return this.resolveFirstWriteWins(serverData);

        case 'merge-content':
          return this.resolveMergeContent(messageId, clientData, serverData, userId);

        case 'user-prompt':
          return this.resolveUserPrompt(clientData, serverData);

        default:
          throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
      }
    } catch (error) {
      console.error('Error resolving message conflict:', error);
      return {
        resolved: false,
        strategy,
        resolvedData: null,
        requiresUserInput: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Last-write-wins for messages
   */
  private static async resolveLastWriteWins(
    messageId: string,
    clientData: any,
    userId: string
  ): Promise<ConflictResolutionResult> {
    // Get current version
    const currentMessage = await prisma.message.findFirst({
      where: { id: messageId, userId },
      select: { version: true },
    });

    if (!currentMessage) {
      throw new Error('Message not found');
    }

    // Update with client data and increment version
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        ...clientData,
        version: currentMessage.version + 1,
        updatedAt: new Date(),
      },
    });

    return {
      resolved: true,
      strategy: 'last-write-wins',
      resolvedData: updatedMessage,
      requiresUserInput: false,
    };
  }

  /**
   * First-write-wins for messages
   */
  private static async resolveFirstWriteWins(
    serverData: any
  ): Promise<ConflictResolutionResult> {
    return {
      resolved: true,
      strategy: 'first-write-wins',
      resolvedData: serverData,
      requiresUserInput: false,
    };
  }

  /**
   * Merge-content for messages using simple text merge
   */
  private static async resolveMergeContent(
    messageId: string,
    clientData: any,
    serverData: any,
    userId: string
  ): Promise<ConflictResolutionResult> {
    // Simple text merge: if both have content changes, concatenate with separator
    let mergedContent = serverData.content;
    
    if (clientData.content && clientData.content !== serverData.content) {
      mergedContent = `${serverData.content}\n\n--- Merged Changes ---\n${clientData.content}`;
    }

    const mergedData = {
      ...serverData,
      ...clientData,
      content: mergedContent,
    };

    // Get current version
    const currentMessage = await prisma.message.findFirst({
      where: { id: messageId, userId },
      select: { version: true },
    });

    if (!currentMessage) {
      throw new Error('Message not found');
    }

    // Update with merged data
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        ...mergedData,
        version: currentMessage.version + 1,
        updatedAt: new Date(),
      },
    });

    return {
      resolved: true,
      strategy: 'merge-content',
      resolvedData: updatedMessage,
      requiresUserInput: false,
      conflictDetails: {
        clientChanges: ['content'],
        serverChanges: ['content'],
        suggestedMerge: mergedData,
      },
    };
  }

  /**
   * User-prompt for messages
   */
  private static async resolveUserPrompt(
    clientData: any,
    serverData: any
  ): Promise<ConflictResolutionResult> {
    return {
      resolved: false,
      strategy: 'user-prompt',
      resolvedData: null,
      requiresUserInput: true,
      conflictDetails: {
        clientChanges: Object.keys(clientData),
        serverChanges: Object.keys(serverData),
        suggestedMerge: {
          client: clientData,
          server: serverData,
        },
      },
    };
  }
}

/**
 * Main conflict resolution service
 */
export class ConflictResolutionService {
  /**
   * Handle thread update with conflict detection and resolution
   */
  static async updateThreadWithConflictResolution(
    threadId: string,
    updateData: any,
    clientVersion: number,
    userId: string,
    strategy: ConflictResolutionStrategy = 'last-write-wins'
  ): Promise<ConflictResolutionResult> {
    try {
      // 1. Detect conflicts
      const conflictResult = await ThreadConflictResolver.detectConflict(
        threadId,
        clientVersion,
        userId
      );

      // 2. If no conflict, proceed with normal update
      if (!conflictResult.hasConflict) {
        const updatedThread = await prisma.thread.update({
          where: { id: threadId },
          data: {
            ...updateData,
            version: clientVersion + 1,
            updatedAt: new Date(),
          },
        });

        return {
          resolved: true,
          strategy: 'no-conflict',
          resolvedData: updatedThread,
          requiresUserInput: false,
        };
      }

      // 3. Get current server data for conflict resolution
      const serverData = await prisma.thread.findFirst({
        where: { id: threadId, userId },
      });

      if (!serverData) {
        throw new Error('Thread not found');
      }

      // 4. Resolve conflict using specified strategy
      return await ThreadConflictResolver.resolveConflict(threadId, {
        strategy,
        clientData: updateData,
        serverData,
        conflictInfo: conflictResult,
        userId,
      });
    } catch (error) {
      console.error('Error in thread conflict resolution:', error);
      return {
        resolved: false,
        strategy,
        resolvedData: null,
        requiresUserInput: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle message update with conflict detection and resolution
   */
  static async updateMessageWithConflictResolution(
    messageId: string,
    updateData: any,
    clientVersion: number,
    userId: string,
    strategy: ConflictResolutionStrategy = 'last-write-wins'
  ): Promise<ConflictResolutionResult> {
    try {
      // 1. Detect conflicts
      const conflictResult = await MessageConflictResolver.detectConflict(
        messageId,
        clientVersion,
        userId
      );

      // 2. If no conflict, proceed with normal update
      if (!conflictResult.hasConflict) {
        const updatedMessage = await prisma.message.update({
          where: { id: messageId },
          data: {
            ...updateData,
            version: clientVersion + 1,
            updatedAt: new Date(),
          },
        });

        return {
          resolved: true,
          strategy: 'no-conflict',
          resolvedData: updatedMessage,
          requiresUserInput: false,
        };
      }

      // 3. Get current server data for conflict resolution
      const serverData = await prisma.message.findFirst({
        where: { id: messageId, userId },
      });

      if (!serverData) {
        throw new Error('Message not found');
      }

      // 4. Resolve conflict using specified strategy
      return await MessageConflictResolver.resolveConflict(messageId, {
        strategy,
        clientData: updateData,
        serverData,
        conflictInfo: conflictResult,
        userId,
      });
    } catch (error) {
      console.error('Error in message conflict resolution:', error);
      return {
        resolved: false,
        strategy,
        resolvedData: null,
        requiresUserInput: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Utility functions for conflict resolution
 */
export const ConflictUtils = {
  /**
   * Get default strategy based on conflict type
   */
  getDefaultStrategy(conflictType: ConflictResult['conflictType']): ConflictResolutionStrategy {
    switch (conflictType) {
      case 'version-mismatch':
        return 'last-write-wins'; // Usually the user expects their changes to be applied
      case 'concurrent-edit':
        return 'merge-content'; // Try to merge when edits happen simultaneously
      default:
        return 'last-write-wins';
    }
  },

  /**
   * Check if conflict requires user intervention
   */
  requiresUserIntervention(
    conflictType: ConflictResult['conflictType'],
    strategy: ConflictResolutionStrategy
  ): boolean {
    return strategy === 'user-prompt' || 
           (conflictType === 'concurrent-edit' && strategy === 'merge-content');
  },

  /**
   * Format conflict details for UI display
   */
  formatConflictForUI(conflict: ConflictResult, clientData: any, serverData: any) {
    return {
      type: conflict.conflictType,
      severity: conflict.conflictType === 'version-mismatch' ? 'high' : 'medium',
      message: this.getConflictMessage(conflict.conflictType),
      clientVersion: conflict.clientVersion,
      serverVersion: conflict.serverVersion,
      lastModified: conflict.lastModified,
      preview: {
        client: this.getDataPreview(clientData),
        server: this.getDataPreview(serverData),
      },
    };
  },

  /**
   * Get human-readable conflict message
   */
  getConflictMessage(conflictType: ConflictResult['conflictType']): string {
    switch (conflictType) {
      case 'version-mismatch':
        return 'This data was modified by another device. Choose how to resolve the conflict.';
      case 'concurrent-edit':
        return 'Simultaneous edits detected. The system will attempt to merge changes.';
      default:
        return 'No conflicts detected.';
    }
  },

  /**
   * Get preview of data changes for UI
   */
  getDataPreview(data: any): string {
    if (data.title) {
      return `Title: "${data.title}"`;
    }
    if (data.content) {
      const preview = data.content.length > 100 
        ? data.content.substring(0, 100) + '...'
        : data.content;
      return `Content: "${preview}"`;
    }
    return 'Data changes';
  },
}; 