import { z } from 'zod';
import { router, publicProcedure } from '../trpc/init.js';

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
      userId: z.string().optional(), // Temporary until auth is implemented
    }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Get userId from authenticated context when Clerk is implemented
      const userId = input.userId || 'temp-user-id';

      const thread = await ctx.prisma.thread.create({
        data: {
          userId,
          title: input.title,
          isPublic: input.isPublic,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      });

      return { thread };
    }),

  // Get thread messages
  getMessages: publicProcedure
    .input(z.object({
      threadId: z.string().cuid(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      interface QueryOptions {
        where: { threadId: string };
        orderBy: { createdAt: 'desc' };
        take: number;
        include: {
          user: {
            select: {
              id: true;
              email: true;
              username: true;
            };
          };
        };
        cursor?: { id: string };
      }

      const queryOptions: QueryOptions = {
        where: {
          threadId: input.threadId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit + 1, // Take one extra to check if there are more
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      };

      if (input.cursor) {
        queryOptions.cursor = { id: input.cursor };
      }

      const messages = await ctx.prisma.message.findMany(queryOptions);

      let nextCursor: string | undefined = undefined;
      if (messages.length > input.limit) {
        const nextItem = messages.pop(); // Remove the extra item
        nextCursor = nextItem?.id;
      }

      return {
        messages: messages.reverse(), // Reverse to get chronological order
        nextCursor,
      };
    }),

  // Send a message (will be used for streaming later)
  sendMessage: publicProcedure
    .input(z.object({
      threadId: z.string().cuid(),
      content: z.string().min(1),
      model: z.string(),
      provider: z.enum(['openai', 'anthropic', 'google', 'mistral', 'openrouter']),
      userId: z.string().optional(), // Temporary until auth is implemented
    }))
    .mutation(async ({ input, ctx }) => {
      // TODO: Get userId from authenticated context when Clerk is implemented
      const userId = input.userId || 'temp-user-id';

      // Create the user message first
      const userMessage = await ctx.prisma.message.create({
        data: {
          threadId: input.threadId,
          userId,
          content: input.content,
          role: 'user',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      });

      // TODO: Implement LLM API call here
      // For now, create a simple assistant response
      const assistantMessage = await ctx.prisma.message.create({
        data: {
          threadId: input.threadId,
          userId,
          content: `Echo: ${input.content}`, // Temporary response
          role: 'assistant',
          model: input.model,
          provider: input.provider,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      });

      return { 
        userMessage,
        assistantMessage,
      };
    }),

  // Get user's threads
  getThreads: publicProcedure
    .input(z.object({
      userId: z.string().optional(), // Temporary until auth is implemented
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // TODO: Get userId from authenticated context when Clerk is implemented
      const userId = input.userId || 'temp-user-id';

      interface ThreadQueryOptions {
        where: { userId: string };
        orderBy: { updatedAt: 'desc' };
        take: number;
        include: {
          _count: {
            select: {
              messages: true;
            };
          };
        };
        cursor?: { id: string };
      }

      const queryOptions: ThreadQueryOptions = {
        where: {
          userId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: input.limit + 1,
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
        },
      };

      if (input.cursor) {
        queryOptions.cursor = { id: input.cursor };
      }

      const threads = await ctx.prisma.thread.findMany(queryOptions);

      let nextCursor: string | undefined = undefined;
      if (threads.length > input.limit) {
        const nextItem = threads.pop();
        nextCursor = nextItem?.id;
      }

      return {
        threads,
        nextCursor,
      };
    }),
}); 