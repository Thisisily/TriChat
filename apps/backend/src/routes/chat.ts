import { z } from 'zod';
import { router, publicProcedure } from '../trpc/init.js';
import { 
  MessageSchema, 
  ThreadSchema, 
  ChatCompletionRequestSchema 
} from '@trichat/shared/types';

export const chatRouter = router({
  // List available models
  models: publicProcedure
    .query(() => {
      return {
        providers: [
          {
            id: 'openai',
            name: 'OpenAI',
            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
          },
          {
            id: 'anthropic', 
            name: 'Anthropic',
            models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
          },
          {
            id: 'google',
            name: 'Google',
            models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
          },
        ],
      };
    }),

  // Create a new thread
  createThread: publicProcedure
    .input(z.object({
      title: z.string().min(1).max(100),
      isPublic: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      // TODO: Implement database creation when Prisma is set up
      const thread = {
        id: crypto.randomUUID(),
        userId: 'temp-user', // Will be replaced with actual user ID
        title: input.title,
        isPublic: input.isPublic,
        parentThreadId: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return { thread };
    }),

  // Get thread messages
  getMessages: publicProcedure
    .input(z.object({
      threadId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // TODO: Implement database query when Prisma is set up
      return {
        messages: [], // Will be populated from database
        nextCursor: null,
      };
    }),

  // Send a message (will be used for streaming later)
  sendMessage: publicProcedure
    .input(z.object({
      threadId: z.string().uuid(),
      content: z.string().min(1),
      model: z.string(),
      provider: z.enum(['openai', 'anthropic', 'google', 'mistral', 'openrouter']),
    }))
    .mutation(async ({ input }) => {
      // TODO: Implement message processing and LLM calling
      const message = {
        id: crypto.randomUUID(),
        threadId: input.threadId,
        userId: 'temp-user',
        content: input.content,
        role: 'user' as const,
        model: input.model,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return { message };
    }),
}); 