import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc/init.js';
import { 
  ConflictResolutionService, 
  ThreadConflictResolver, 
  MessageConflictResolver,
  ConflictUtils,
  type ConflictResolutionStrategy 
} from '../lib/conflict-resolution.js';

// Validation schemas
const conflictResolutionStrategySchema = z.enum([
  'last-write-wins',
  'first-write-wins',
  'merge-content',
  'user-prompt'
]);

const threadUpdateSchema = z.object({
  threadId: z.string().cuid(),
  updateData: z.object({
    title: z.string().optional(),
    isPublic: z.boolean().optional(),
  }),
  clientVersion: z.number().int().positive(),
  strategy: conflictResolutionStrategySchema.default('last-write-wins'),
});

const messageUpdateSchema = z.object({
  messageId: z.string().cuid(),
  updateData: z.object({
    content: z.string().optional(),
  }),
  clientVersion: z.number().int().positive(),
  strategy: conflictResolutionStrategySchema.default('last-write-wins'),
});

const conflictDetectionSchema = z.object({
  resourceId: z.string().cuid(),
  clientVersion: z.number().int().positive(),
  resourceType: z.enum(['thread', 'message']),
});

export const conflictResolutionRouter = router({
  /**
   * Detect conflicts for a specific resource
   */
  detectConflict: authenticatedProcedure
    .input(conflictDetectionSchema)
    .query(async ({ input, ctx }) => {
      const { resourceId, clientVersion, resourceType } = input;
      const userId = ctx.user.id;

      try {
        let conflictResult;

        if (resourceType === 'thread') {
          conflictResult = await ThreadConflictResolver.detectConflict(
            resourceId,
            clientVersion,
            userId
          );
        } else {
          conflictResult = await MessageConflictResolver.detectConflict(
            resourceId,
            clientVersion,
            userId
          );
        }

        return {
          success: true,
          conflict: conflictResult,
          defaultStrategy: ConflictUtils.getDefaultStrategy(conflictResult.conflictType),
          requiresUserIntervention: ConflictUtils.requiresUserIntervention(
            conflictResult.conflictType,
            ConflictUtils.getDefaultStrategy(conflictResult.conflictType)
          ),
        };
      } catch (error) {
        console.error('Error detecting conflict:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          conflict: null,
        };
      }
    }),

  /**
   * Update thread with conflict resolution
   */
  updateThreadWithResolution: authenticatedProcedure
    .input(threadUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const { threadId, updateData, clientVersion, strategy } = input;
      const userId = ctx.user.id;

      try {
        const result = await ConflictResolutionService.updateThreadWithConflictResolution(
          threadId,
          updateData,
          clientVersion,
          userId,
          strategy as ConflictResolutionStrategy
        );

        return {
          success: result.resolved,
          result,
          thread: result.resolvedData,
          requiresUserInput: result.requiresUserInput,
          conflictDetails: result.conflictDetails,
          error: result.error,
        };
      } catch (error) {
        console.error('Error updating thread with conflict resolution:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          result: null,
        };
      }
    }),

  /**
   * Update message with conflict resolution
   */
  updateMessageWithResolution: authenticatedProcedure
    .input(messageUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const { messageId, updateData, clientVersion, strategy } = input;
      const userId = ctx.user.id;

      try {
        const result = await ConflictResolutionService.updateMessageWithConflictResolution(
          messageId,
          updateData,
          clientVersion,
          userId,
          strategy as ConflictResolutionStrategy
        );

        return {
          success: result.resolved,
          result,
          message: result.resolvedData,
          requiresUserInput: result.requiresUserInput,
          conflictDetails: result.conflictDetails,
          error: result.error,
        };
      } catch (error) {
        console.error('Error updating message with conflict resolution:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          result: null,
        };
      }
    }),

  /**
   * Get conflict resolution options for UI
   */
  getResolutionOptions: authenticatedProcedure
    .input(z.object({
      conflictType: z.enum(['version-mismatch', 'concurrent-edit', 'none']),
      resourceType: z.enum(['thread', 'message']),
      clientData: z.any(),
      serverData: z.any(),
    }))
    .query(async ({ input }) => {
      const { conflictType, resourceType, clientData, serverData } = input;

      try {
        const options = {
          availableStrategies: [
            {
              strategy: 'last-write-wins' as const,
              label: 'Use My Changes',
              description: 'Keep your changes and discard server changes',
              recommended: conflictType === 'version-mismatch',
            },
            {
              strategy: 'first-write-wins' as const,
              label: 'Keep Server Changes',
              description: 'Discard your changes and keep server version',
              recommended: false,
            },
            {
              strategy: 'merge-content' as const,
              label: 'Merge Changes',
              description: 'Attempt to combine both versions intelligently',
              recommended: conflictType === 'concurrent-edit',
            },
            {
              strategy: 'user-prompt' as const,
              label: 'Manual Resolution',
              description: 'Choose specific parts to keep from each version',
              recommended: false,
            },
          ],
          conflictPreview: ConflictUtils.formatConflictForUI(
            {
              hasConflict: true,
              conflictType,
              clientVersion: 0,
              serverVersion: 0,
            },
            clientData,
            serverData
          ),
          defaultStrategy: ConflictUtils.getDefaultStrategy(conflictType),
        };

        return {
          success: true,
          options,
        };
      } catch (error) {
        console.error('Error getting resolution options:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          options: null,
        };
      }
    }),

  /**
   * Resolve user-prompted conflicts
   */
  resolveUserPromptedConflict: authenticatedProcedure
    .input(z.object({
      resourceId: z.string().cuid(),
      resourceType: z.enum(['thread', 'message']),
      resolution: z.object({
        strategy: z.enum(['keep-client', 'keep-server', 'custom-merge']),
        mergedData: z.any().optional(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      const { resourceId, resourceType, resolution } = input;
      const userId = ctx.user.id;

      try {
        let result;

        if (resourceType === 'thread') {
          if (resolution.strategy === 'keep-client' || resolution.strategy === 'custom-merge') {
            const updateData = resolution.mergedData || resolution.strategy === 'keep-client';
            result = await ConflictResolutionService.updateThreadWithConflictResolution(
              resourceId,
              updateData,
              0, // Version will be handled internally
              userId,
              'last-write-wins'
            );
          } else {
            // keep-server: no update needed, just return current data
            const thread = await ctx.prisma.thread.findUnique({
              where: { id: resourceId },
            });
            result = {
              resolved: true,
              strategy: 'first-write-wins',
              resolvedData: thread,
              requiresUserInput: false,
            };
          }
        } else {
          // Message resolution similar logic
          if (resolution.strategy === 'keep-client' || resolution.strategy === 'custom-merge') {
            const updateData = resolution.mergedData || resolution.strategy === 'keep-client';
            result = await ConflictResolutionService.updateMessageWithConflictResolution(
              resourceId,
              updateData,
              0, // Version will be handled internally
              userId,
              'last-write-wins'
            );
          } else {
            const message = await ctx.prisma.message.findUnique({
              where: { id: resourceId },
            });
            result = {
              resolved: true,
              strategy: 'first-write-wins',
              resolvedData: message,
              requiresUserInput: false,
            };
          }
        }

        return {
          success: result.resolved,
          result,
          data: result.resolvedData,
        };
      } catch (error) {
        console.error('Error resolving user-prompted conflict:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          result: null,
        };
      }
    }),

  /**
   * Get conflict resolution statistics for monitoring
   */
  getConflictStats: authenticatedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;

      try {
        // Get recent thread and message updates to analyze conflict frequency
        const recentThreads = await ctx.prisma.thread.findMany({
          where: {
            userId,
            updatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
          select: {
            id: true,
            version: true,
            updatedAt: true,
          },
        });

        const recentMessages = await ctx.prisma.message.findMany({
          where: {
            userId,
            updatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
          select: {
            id: true,
            version: true,
            updatedAt: true,
          },
        });

        // Calculate basic statistics
        const stats = {
          threadsWithVersioning: recentThreads.filter(t => t.version > 1).length,
          messagesWithVersioning: recentMessages.filter(m => m.version > 1).length,
          totalThreads: recentThreads.length,
          totalMessages: recentMessages.length,
          averageThreadVersion: recentThreads.reduce((sum, t) => sum + t.version, 0) / recentThreads.length || 0,
          averageMessageVersion: recentMessages.reduce((sum, m) => sum + m.version, 0) / recentMessages.length || 0,
          multiDeviceUsageIndicator: recentThreads.filter(t => t.version > 2).length + recentMessages.filter(m => m.version > 2).length,
        };

        return {
          success: true,
          stats: {
            ...stats,
            conflictPrevention: {
              enabled: true,
              strategies: ['last-write-wins', 'merge-content', 'user-prompt'],
              lastWeekActivity: recentThreads.length + recentMessages.length,
            },
          },
        };
      } catch (error) {
        console.error('Error getting conflict stats:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stats: null,
        };
      }
    }),
}); 