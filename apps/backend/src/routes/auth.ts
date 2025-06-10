import { z } from 'zod';
import { router, publicProcedure, authenticatedProcedure } from '../trpc/init.js';
import { syncUserToDatabase } from '../lib/auth.js';

export const authRouter = router({
  // Get current user profile
  me: authenticatedProcedure
    .query(async ({ ctx }) => {
      const { user, prisma } = ctx;
      
      // Get user data from database
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        include: {
          apiKeys: {
            select: {
              id: true,
              provider: true,
              keyName: true,
              createdAt: true,
              // Don't return encrypted keys for security
            },
          },
          _count: {
            select: {
              threads: true,
              messages: true,
            },
          },
        },
      });

      if (!dbUser) {
        throw new Error('User not found in database');
      }

      return {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          username: dbUser.username,
          createdAt: dbUser.createdAt,
          updatedAt: dbUser.updatedAt,
          apiKeys: dbUser.apiKeys,
          stats: dbUser._count,
        },
      };
    }),

  // Update user profile
  updateProfile: authenticatedProcedure
    .input(z.object({
      username: z.string().min(1).max(50).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      // Build update object conditionally to avoid TypeScript strict issues
      const updateData: { username?: string; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      
      if (input.username !== undefined) {
        updateData.username = input.username;
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.userId },
        data: updateData,
      });

      return { user: updatedUser };
    }),

  // Store encrypted API key for LLM providers
  addApiKey: authenticatedProcedure
    .input(z.object({
      provider: z.enum(['openai', 'anthropic', 'google', 'mistral', 'openrouter']),
      keyName: z.string().min(1).max(100),
      encryptedKey: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      const apiKey = await prisma.userApiKey.create({
        data: {
          userId: user.userId,
          provider: input.provider,
          keyName: input.keyName,
          encrypted: input.encryptedKey,
        },
      });

      return { 
        apiKey: {
          id: apiKey.id,
          provider: apiKey.provider,
          keyName: apiKey.keyName,
          createdAt: apiKey.createdAt,
        },
      };
    }),

  // Remove API key
  removeApiKey: authenticatedProcedure
    .input(z.object({
      apiKeyId: z.string().cuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      // Ensure user can only delete their own API keys
      await prisma.userApiKey.deleteMany({
        where: {
          id: input.apiKeyId,
          userId: user.userId,
        },
      });

      return { success: true };
    }),

  // Clerk webhook handler for user sync
  webhook: publicProcedure
    .input(z.object({
      type: z.string(),
      data: z.any(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Note: In a real app, you'd verify the webhook signature here
      // For now, we'll just handle the basic user events
      
      try {
        switch (input.type) {
          case 'user.created':
          case 'user.updated':
            await syncUserToDatabase(input.data);
            break;
          
          case 'user.deleted':
            if (input.data?.id) {
              await ctx.prisma.user.delete({
                where: { id: input.data.id },
              });
            }
            break;
            
          default:
            console.log(`Unhandled webhook type: ${input.type}`);
        }

        return { success: true };
      } catch (error) {
        console.error('Webhook processing error:', error);
        throw new Error('Failed to process webhook');
      }
    }),

  // Sign out (clear local session - Clerk handles this on frontend)
  signOut: authenticatedProcedure
    .mutation(async () => {
      // In a traditional app, you might invalidate tokens here
      // With Clerk, sign-out is primarily handled on the frontend
      return { success: true };
    }),
}); 