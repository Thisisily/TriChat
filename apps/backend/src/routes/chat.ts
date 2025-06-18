import { z } from 'zod';
import { router, publicProcedure, authenticatedProcedure } from '../trpc/init.js';
import { observable } from '@trpc/server/observable';
import { 
  generateLLMStreamResponse, 
  getUserApiKey, 
  validateModelForProvider,
  LLMServiceFactory,
  type LLMMessage,
  type LLMProvider 
  } from '../lib/llm.js';
  import { streamingUtils } from '../lib/streaming.js';
  import { TRPCError } from '@trpc/server';
  import {
  getThreadHistory,
  getUpdatedThreadsSince,
  getThreadWithMessages,
  searchThreads,
  getThreadStats,
  updateUserLastSync,
  getUserLastSync,
  type ThreadHistoryOptions,
} from '../lib/thread-history.js';
import {
  retrieveContextualMemories,
  analyzeConversationForMemory,
  createMemoryFromConversation,
  type MemoryRetrievalOptions,
  type ContextualMemoryResult,
} from '../lib/memory-integration.js';
  
  // Input validation schemas
const ThreadIdSchema = z.string().cuid();
const MessageContentSchema = z.string().min(1).max(50000);
const ModelProviderSchema = z.enum(['openai', 'anthropic', 'google', 'mistral', 'openrouter']);

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
  createThread: authenticatedProcedure
    .input(z.object({
      title: z.string().min(1).max(100),
      isPublic: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      const thread = await prisma.thread.create({
        data: {
          userId: user.userId,
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

  // Update thread
  updateThread: authenticatedProcedure
    .input(z.object({
      threadId: ThreadIdSchema,
      title: z.string().min(1).max(100).optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      // Verify thread ownership
      const existingThread = await prisma.thread.findFirst({
        where: {
          id: input.threadId,
          userId: user.userId,
        },
      });

      if (!existingThread) {
        throw new Error('Thread not found or access denied');
      }

      const updateData: { title?: string; isPublic?: boolean; updatedAt: Date } = {
        updatedAt: new Date(),
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

      const thread = await prisma.thread.update({
        where: { id: input.threadId },
        data: updateData,
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

  // Delete thread
  deleteThread: authenticatedProcedure
    .input(z.object({
      threadId: ThreadIdSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      // Verify thread ownership
      const existingThread = await prisma.thread.findFirst({
        where: {
          id: input.threadId,
          userId: user.userId,
        },
      });

      if (!existingThread) {
        throw new Error('Thread not found or access denied');
      }

      await prisma.thread.delete({
        where: { id: input.threadId },
      });

      return { success: true, threadId: input.threadId };
    }),

  // Get thread messages with pagination
  getMessages: authenticatedProcedure
    .input(z.object({
      threadId: z.string(),
      limit: z.number().default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const queryOptions: any = {
        where: {
          threadId: input.threadId,
          userId: ctx.user.userId,
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
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit + 1,
      };

      if (input.cursor) {
        queryOptions.cursor = { id: input.cursor };
      }

      const messages = await ctx.prisma.message.findMany(queryOptions);

      let nextCursor: string | undefined = undefined;
      if (messages.length > input.limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem!.id;
      }

      // Get Trinity data for messages that have it
      const messageIds = messages.map(m => m.id);
      let trinityData: Array<{ message_id: string; data: any }> = [];
      
      if (messageIds.length > 0) {
        try {
          // PostgreSQL uses $1, $2, etc. for parameters
          const placeholders = messageIds.map((_, index) => `$${index + 1}`).join(',');
          trinityData = await ctx.prisma.$queryRawUnsafe<Array<{ message_id: string; data: any }>>(
            `SELECT message_id, data FROM trinity_responses WHERE message_id IN (${placeholders})`,
            ...messageIds
          );
        } catch (error) {
          console.warn('Failed to fetch Trinity data:', error);
          // Continue without Trinity data
        }
      }

      // Create a map of message ID to Trinity data
      const trinityMap = new Map<string, any>();
      for (const item of trinityData) {
        try {
          trinityMap.set(item.message_id, typeof item.data === 'string' ? JSON.parse(item.data) : item.data);
        } catch (e) {
          console.error('Failed to parse Trinity data:', e);
        }
      }

      return {
        messages: messages.reverse(),
        nextCursor,
        trinityData: Object.fromEntries(trinityMap),
      };
    }),

  // Send a message with LLM integration
  sendMessage: authenticatedProcedure
    .input(z.object({
      threadId: ThreadIdSchema,
      content: MessageContentSchema,
      model: z.string(),
      provider: ModelProviderSchema,
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().min(1).max(4096).default(2048),
      autoMemoryEnabled: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      // Verify thread access
      const thread = await prisma.thread.findFirst({
        where: {
          id: input.threadId,
          userId: user.userId,
        },
      });

      if (!thread) {
        throw new Error('Thread not found or access denied');
      }

      // Validate model for provider
      if (!validateModelForProvider(input.provider as LLMProvider, input.model)) {
        throw new Error(`Invalid model ${input.model} for provider ${input.provider}`);
      }

      // Get user's API key for the provider
      const apiKey = await getUserApiKey(user.userId, input.provider as LLMProvider, prisma);
      if (!apiKey) {
        throw new Error(`No API key found for provider ${input.provider}. Please add your API key in settings.`);
      }

      // Create the user message first
      const userMessage = await prisma.message.create({
        data: {
          threadId: input.threadId,
          userId: user.userId,
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

      // Create placeholder assistant message
      const assistantMessage = await prisma.message.create({
        data: {
          threadId: input.threadId,
          userId: user.userId,
          content: '', // Will be updated via streaming
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

      // Start streaming response in the background
      setImmediate(async () => {
        try {
          // Get conversation history
          const previousMessages = await prisma.message.findMany({
            where: { threadId: input.threadId },
            orderBy: { createdAt: 'asc' },
            take: 20, // Limit context window
          });

          // Convert to LLM format
          const llmMessages: LLMMessage[] = previousMessages
            .filter(msg => msg.content.trim()) // Filter out empty messages
            .map(msg => ({
              role: msg.role as 'user' | 'assistant' | 'system',
              content: msg.content,
            }));

          // 🧠 MEMORY-CARDS INTEGRATION: Retrieve contextual memories
          let memoryContext = '';
          try {
            // Get user's OpenAI API key for embeddings
            const openAIKey = await getUserApiKey(user.userId, 'openai', prisma);
            
            const memoryOptions: MemoryRetrievalOptions = {
              userId: user.userId,
              query: input.content,
              limit: 5,
              threshold: 0.3,
            };
            
            if (openAIKey) {
              memoryOptions.apiKey = openAIKey;
            }
            
            const memoryResults = await retrieveContextualMemories(memoryOptions);
            
            if (memoryResults.memoryCount > 0) {
              memoryContext = memoryResults.contextPrompt;
              console.log(`Retrieved ${memoryResults.memoryCount} relevant memories for user ${user.userId}`);
            }
          } catch (error) {
            console.error('Error retrieving contextual memories:', error);
            // Continue without memories if there's an error
          }

          // Add memory context to the beginning of conversation if available
          if (memoryContext) {
            // Add a system message that instructs the AI to use the memories
            llmMessages.unshift({
              role: 'system',
              content: `You are a helpful AI assistant with access to the user's personal memory cards. Use the following memories to provide personalized and contextual responses. These memories contain important information about the user that you should reference when relevant.\n${memoryContext}`,
            });
          }

          // Generate streaming response
          const streamGenerator = generateLLMStreamResponse(llmMessages, {
            model: input.model,
            provider: input.provider as LLMProvider,
            apiKey,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            stream: true,
          });

          let accumulatedContent = '';
          
          for await (const chunk of streamGenerator) {
            accumulatedContent = chunk.content;

            // Send real-time update via WebSocket/SSE
            streamingUtils.sendToUser(user.userId, {
              type: 'chat_response',
              id: `stream_${assistantMessage.id}_${Date.now()}`,
              threadId: input.threadId,
              userId: user.userId,
              data: {
                messageId: assistantMessage.id,
                content: chunk.content,
                delta: chunk.delta,
                role: 'assistant',
                model: input.model,
                provider: input.provider,
                isComplete: chunk.isComplete,
                usage: chunk.usage,
              },
              timestamp: Date.now(),
            });
          }

          // Update the assistant message with final content
          await prisma.message.update({
            where: { id: assistantMessage.id },
            data: { 
              content: accumulatedContent,
              updatedAt: new Date(),
            },
          });

          // 🧠 MEMORY-CARDS INTEGRATION: Analyze and create memory if auto-enabled
          if (accumulatedContent && input.autoMemoryEnabled) {
            try {
              // Analyze conversation for memory creation
              const analysis = await analyzeConversationForMemory(
                llmMessages.slice(-10), // Last 10 messages for context
                accumulatedContent
              );
              
              if (analysis.shouldCreateMemory && analysis.memoryTitle) {
                const memoryCardId = await createMemoryFromConversation(
                  user.userId,
                  analysis,
                  input.threadId
                );
                
                if (memoryCardId) {
                  console.log(`Auto-created memory card: ${memoryCardId}`);
                  
                  // Send notification via streaming
                  streamingUtils.sendToUser(user.userId, {
                    type: 'memory_created',
                    id: `memory_${memoryCardId}`,
                    threadId: input.threadId,
                    userId: user.userId,
                    data: {
                      memoryCardId,
                      title: analysis.memoryTitle,
                      confidence: analysis.confidence,
                    },
                    timestamp: Date.now(),
                  });
                }
              }
            } catch (error) {
              console.error('Error in auto-memory creation:', error);
              // Don't fail the message if memory creation fails
            }
          }

          // Send completion message
          streamingUtils.sendToUser(user.userId, {
            type: 'chat_complete',
            id: `complete_${assistantMessage.id}`,
            threadId: input.threadId,
            userId: user.userId,
            data: {
              messageId: assistantMessage.id,
              content: accumulatedContent,
              role: 'assistant',
              model: input.model,
              provider: input.provider,
              isComplete: true,
            },
            timestamp: Date.now(),
          });

        } catch (error) {
          console.error('LLM streaming error:', error);
          
          // Update message with error
          await prisma.message.update({
            where: { id: assistantMessage.id },
            data: { 
              content: `Error: ${error instanceof Error ? error.message : 'Failed to generate response'}`,
              updatedAt: new Date(),
            },
          });

          // Send error message via streaming
          streamingUtils.sendToUser(user.userId, {
            type: 'error',
            id: `error_${assistantMessage.id}`,
            threadId: input.threadId,
            userId: user.userId,
            data: {
              messageId: assistantMessage.id,
              error: error instanceof Error ? error.message : 'Failed to generate response',
            },
            timestamp: Date.now(),
          });
        }
      });

      return { 
        userMessage,
        assistantMessage,
      };
    }),

  // Get user's threads with search and filtering
  getThreads: authenticatedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
      search: z.string().optional(),
      isPublic: z.boolean().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      interface ThreadQueryOptions {
        where: {
          userId: string;
          isPublic?: boolean;
          title?: {
            contains: string;
            mode: 'insensitive';
          };
        };
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

      const whereClause: ThreadQueryOptions['where'] = {
        userId: user.userId,
      };

      if (input.isPublic !== undefined) {
        whereClause.isPublic = input.isPublic;
      }

      if (input.search) {
        whereClause.title = {
          contains: input.search,
          mode: 'insensitive',
        };
      }

      const queryOptions: ThreadQueryOptions = {
        where: whereClause,
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

      const threads = await prisma.thread.findMany(queryOptions);

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

  // Get thread details with comprehensive information
  getThreadDetails: authenticatedProcedure
    .input(z.object({
      threadId: ThreadIdSchema,
    }))
    .query(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      // Verify thread access
      const thread = await prisma.thread.findFirst({
        where: {
          id: input.threadId,
          OR: [
            { userId: user.userId },
            { isPublic: true },
          ],
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

      if (!thread) {
        throw new Error('Thread not found or access denied');
      }

      // Get additional statistics
      const messageStats = await prisma.message.groupBy({
        by: ['role'],
        where: {
          threadId: input.threadId,
        },
        _count: {
          role: true,
        },
      });

      // Get last message
      const lastMessage = await prisma.message.findFirst({
        where: {
          threadId: input.threadId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          content: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      // Get first message
      const firstMessage = await prisma.message.findFirst({
        where: {
          threadId: input.threadId,
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          createdAt: true,
        },
      });

             // Calculate statistics
       const roleStats = messageStats.reduce((acc, stat) => {
         acc[stat.role] = stat._count.role;
         return acc;
       }, {} as Record<string, number>);

       return {
         thread,
         statistics: {
           totalMessages: thread._count.messages,
           messagesByRole: {
             user: roleStats['user'] || 0,
             assistant: roleStats['assistant'] || 0,
             system: roleStats['system'] || 0,
           },
           firstMessageAt: firstMessage?.createdAt,
           lastMessageAt: lastMessage?.createdAt,
           lastActivity: thread.updatedAt,
         },
         lastMessage,
         isOwner: thread.userId === user.userId,
       };
    }),

  // Search threads with advanced filtering
  searchThreads: authenticatedProcedure
    .input(z.object({
      query: z.string().min(1),
      isPublic: z.boolean().optional(),
      hasMessages: z.boolean().optional(),
      createdAfter: z.date().optional(),
      createdBefore: z.date().optional(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      interface ThreadSearchOptions {
        where: {
          userId: string;
          isPublic?: boolean;
          createdAt?: {
            gte?: Date;
            lte?: Date;
          };
          title?: {
            contains: string;
            mode: 'insensitive';
          };
          messages?: {
            some: {};
          };
        };
        orderBy: { updatedAt: 'desc' };
        take: number;
        include: {
          user: {
            select: {
              id: true;
              email: true;
              username: true;
            };
          };
          _count: {
            select: {
              messages: true;
            };
          };
        };
        cursor?: { id: string };
      }

      const whereClause: ThreadSearchOptions['where'] = {
        userId: user.userId,
        title: {
          contains: input.query,
          mode: 'insensitive',
        },
      };

      if (input.isPublic !== undefined) {
        whereClause.isPublic = input.isPublic;
      }

      if (input.hasMessages !== undefined && input.hasMessages) {
        whereClause.messages = { some: {} };
      }

      if (input.createdAfter || input.createdBefore) {
        whereClause.createdAt = {};
        if (input.createdAfter) {
          whereClause.createdAt.gte = input.createdAfter;
        }
        if (input.createdBefore) {
          whereClause.createdAt.lte = input.createdBefore;
        }
      }

      const queryOptions: ThreadSearchOptions = {
        where: whereClause,
        orderBy: {
          updatedAt: 'desc',
        },
        take: input.limit + 1,
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
      };

      if (input.cursor) {
        queryOptions.cursor = { id: input.cursor };
      }

      const threads = await prisma.thread.findMany(queryOptions);

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

  // Search messages across threads
  searchMessages: authenticatedProcedure
    .input(z.object({
      query: z.string().min(1),
      threadId: ThreadIdSchema.optional(),
      role: z.enum(['user', 'assistant', 'system']).optional(),
      model: z.string().optional(),
      provider: ModelProviderSchema.optional(),
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      interface MessageQueryOptions {
        where: {
          userId: string;
          threadId?: string;
          role?: 'user' | 'assistant' | 'system';
          model?: string;
          provider?: string;
          content: {
            contains: string;
            mode: 'insensitive';
          };
        };
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
          thread: {
            select: {
              id: true;
              title: true;
            };
          };
        };
        cursor?: { id: string };
      }

      const whereClause: MessageQueryOptions['where'] = {
        userId: user.userId,
        content: {
          contains: input.query,
          mode: 'insensitive',
        },
      };

      if (input.threadId) whereClause.threadId = input.threadId;
      if (input.role) whereClause.role = input.role;
      if (input.model) whereClause.model = input.model;
      if (input.provider) whereClause.provider = input.provider;

      const queryOptions: MessageQueryOptions = {
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit + 1,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
          thread: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      };

      if (input.cursor) {
        queryOptions.cursor = { id: input.cursor };
      }

      const messages = await prisma.message.findMany(queryOptions);

      let nextCursor: string | undefined = undefined;
      if (messages.length > input.limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem?.id;
      }

      return {
        messages,
        nextCursor,
      };
    }),

  // Get message history with advanced filtering and statistics
  getMessageHistory: authenticatedProcedure
    .input(z.object({
      threadId: ThreadIdSchema.optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      role: z.enum(['user', 'assistant', 'system']).optional(),
      model: z.string().optional(),
      provider: ModelProviderSchema.optional(),
      includeStats: z.boolean().default(false),
      limit: z.number().min(1).max(200).default(100),
      cursor: z.string().optional(),
      orderBy: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
      orderDirection: z.enum(['asc', 'desc']).default('desc'),
    }))
    .query(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      // Build where clause
      interface HistoryQueryOptions {
        where: {
          userId: string;
          threadId?: string;
          role?: 'user' | 'assistant' | 'system';
          model?: string;
          provider?: string;
          createdAt?: {
            gte?: Date;
            lte?: Date;
          };
        };
        orderBy: { [key: string]: 'asc' | 'desc' };
        take: number;
        include: {
          user: {
            select: {
              id: true;
              email: true;
              username: true;
            };
          };
          thread: {
            select: {
              id: true;
              title: true;
            };
          };
        };
        cursor?: { id: string };
      }

      const whereClause: HistoryQueryOptions['where'] = {
        userId: user.userId,
      };

      if (input.threadId) whereClause.threadId = input.threadId;
      if (input.role) whereClause.role = input.role;
      if (input.model) whereClause.model = input.model;
      if (input.provider) whereClause.provider = input.provider;

      if (input.startDate || input.endDate) {
        whereClause.createdAt = {};
        if (input.startDate) whereClause.createdAt.gte = input.startDate;
        if (input.endDate) whereClause.createdAt.lte = input.endDate;
      }

      const queryOptions: HistoryQueryOptions = {
        where: whereClause,
        orderBy: { [input.orderBy]: input.orderDirection },
        take: input.limit + 1,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
          thread: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      };

      if (input.cursor) {
        queryOptions.cursor = { id: input.cursor };
      }

      const messages = await prisma.message.findMany(queryOptions);

      let nextCursor: string | undefined = undefined;
      if (messages.length > input.limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem?.id;
      }

      // Get statistics if requested
      let statistics;
      if (input.includeStats) {
        const [totalCount, roleStats, providerStats] = await Promise.all([
          // Total count
          prisma.message.count({
            where: whereClause,
          }),
          // Messages by role
          prisma.message.groupBy({
            by: ['role'],
            where: whereClause,
            _count: { role: true },
          }),
          // Messages by provider
          prisma.message.groupBy({
            by: ['provider'],
            where: {
              ...whereClause,
              provider: { not: null },
            },
            _count: { provider: true },
          }),
        ]);

        const roleBreakdown = roleStats.reduce((acc, stat) => {
          acc[stat.role] = stat._count.role;
          return acc;
        }, {} as Record<string, number>);

        const providerBreakdown = providerStats.reduce((acc, stat) => {
          if (stat.provider) {
            acc[stat.provider] = stat._count.provider;
          }
          return acc;
        }, {} as Record<string, number>);

        statistics = {
          totalCount,
          roleBreakdown: {
            user: roleBreakdown['user'] || 0,
            assistant: roleBreakdown['assistant'] || 0,
            system: roleBreakdown['system'] || 0,
          },
          providerBreakdown,
          dateRange: {
            start: input.startDate,
            end: input.endDate,
          },
        };
      }

      return {
        messages,
        nextCursor,
        statistics,
      };
    }),

  // Stream a response for a message using tRPC subscriptions
  streamResponse: authenticatedProcedure
    .input(z.object({
      threadId: z.string(),
      messageId: z.string(),
    }))
    .subscription(async function* ({ input, ctx }) {
      // Get the message to stream response for
      const message = await ctx.prisma.message.findFirst({
        where: {
          id: input.messageId,
          thread: { userId: ctx.user.userId },
        },
        include: {
          thread: {
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                take: 50, // Last 50 messages for context
              },
            },
          },
        },
      });

      if (!message || message.role !== 'user') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Message not found or not a user message',
        });
      }

      try {
        // Convert to LLM messages format
        const llmMessages: LLMMessage[] = message.thread.messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));

        // Generate streaming response
                 const llmService = LLMServiceFactory.getService('openai');
         const streamGenerator = llmService.generateStreamResponse(llmMessages, {
           model: 'gpt-4o',
           provider: 'openai',
           apiKey: process.env['OPENAI_API_KEY'] || '',
          temperature: 0.7,
          maxTokens: 1000,
          stream: true,
        });

        let content = '';
        let assistantMessage: any = null;

        for await (const chunk of streamGenerator) {
          content = chunk.content;
          
          // Create or update assistant message
          if (!assistantMessage) {
                       assistantMessage = await ctx.prisma.message.create({
             data: {
               threadId: input.threadId,
               userId: ctx.user.userId,
               role: 'assistant',
               content: '',
               model: 'gpt-4o',
               provider: 'openai',
             },
           });
          }

          // Update message content
          await ctx.prisma.message.update({
            where: { id: assistantMessage.id },
            data: { content },
          });

          // Yield streaming chunk
          yield {
            messageId: assistantMessage.id,
            content: chunk.content,
            delta: chunk.delta,
            isComplete: chunk.isComplete,
            usage: chunk.usage,
          };

          // Note: WebSocket broadcasting would be implemented here
          // if webSocketManager was available
        }
      } catch (error) {
        console.error('Streaming error:', error);
        yield {
          messageId: '',
          content: 'Error generating response',
          delta: '',
          isComplete: true,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }),

  // Trinity Mode Procedures

  // Send a message using Trinity Mode (3 agents + orchestrator)
  sendTrinityMessage: authenticatedProcedure
    .input(z.object({
      threadId: z.string(),
      content: z.string(),
      trinityConfig: z.object({
        executionMode: z.enum(['parallel', 'sequential', 'hybrid']),
        preset: z.string().optional(),
        customConfig: z.any().optional(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify thread ownership
      const thread = await ctx.prisma.thread.findFirst({
        where: {
          id: input.threadId,
          userId: ctx.user.userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
        },
      });

      if (!thread) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Thread not found',
        });
      }

      try {
        // Create user message
                 const userMessage = await ctx.prisma.message.create({
           data: {
             threadId: input.threadId,
             userId: ctx.user.userId,
             role: 'user',
             content: input.content,
           },
         });

         // Convert to LLM messages format
         const llmMessages: LLMMessage[] = [
           ...thread.messages.map(m => ({
             role: m.role as 'user' | 'assistant' | 'system',
             content: m.content,
           })),
           {
             role: 'user',
             content: input.content,
           },
         ];

         // Import Trinity Mode components
         const { TrinityExecutionManager } = await import('../lib/trinity-manager.js');
         const { DEFAULT_TRINITY_CONFIG, TRINITY_PRESETS } = await import('../lib/trinity-mode.js');
         
         const trinityManager = new TrinityExecutionManager();

         // Determine configuration
         let trinityConfig = DEFAULT_TRINITY_CONFIG;
         if (input.trinityConfig.preset && TRINITY_PRESETS[input.trinityConfig.preset]) {
           trinityConfig = {
             ...DEFAULT_TRINITY_CONFIG,
             ...TRINITY_PRESETS[input.trinityConfig.preset],
             executionMode: input.trinityConfig.executionMode,
           };
         } else if (input.trinityConfig.customConfig) {
           trinityConfig = input.trinityConfig.customConfig;
         } else {
           trinityConfig = {
             ...DEFAULT_TRINITY_CONFIG,
             executionMode: input.trinityConfig.executionMode,
           };
         }

         // Execute Trinity Mode
         let trinityResponse;
         switch (trinityConfig.executionMode) {
           case 'parallel':
             trinityResponse = await trinityManager.executeParallel(llmMessages, trinityConfig);
             break;
           case 'sequential':
             trinityResponse = await trinityManager.executeSequential(llmMessages, trinityConfig);
             break;
           case 'hybrid':
             trinityResponse = await trinityManager.executeHybrid(llmMessages, trinityConfig);
             break;
           default:
             throw new Error(`Unknown execution mode: ${trinityConfig.executionMode}`);
         }

         // Create assistant message with Trinity response
         const assistantMessage = await ctx.prisma.message.create({
           data: {
             threadId: input.threadId,
             userId: ctx.user.userId,
             role: 'assistant',
             content: trinityResponse.finalResponse,
             model: 'trinity-mode',
             provider: 'trinity',
           },
         });

         console.log('Trinity response created for thread:', input.threadId);

        return {
          userMessage,
          assistantMessage,
          trinityData: {
            agentResponses: trinityResponse.agentResponses,
            attribution: trinityResponse.attribution,
            orchestratorMetadata: trinityResponse.orchestratorMetadata,
          },
        };

      } catch (error) {
        console.error('Trinity mode error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Trinity mode execution failed',
        });
      }
    }),

  // Stream Trinity Mode response in real-time
  streamTrinityResponse: authenticatedProcedure
    .input(z.object({
      threadId: z.string(),
      content: z.string(),
      trinityConfig: z.object({
        executionMode: z.enum(['parallel', 'sequential', 'hybrid']),
        preset: z.string().optional(),
        customConfig: z.any().optional(),
      }),
    }))
    .subscription(async function* ({ input, ctx }) {
      // Verify thread ownership
      const thread = await ctx.prisma.thread.findFirst({
        where: {
          id: input.threadId,
          userId: ctx.user.userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
        },
      });

      if (!thread) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Thread not found',
        });
      }

      try {
        // Create user message
        const userMessage = await ctx.prisma.message.create({
          data: {
            threadId: input.threadId,
            userId: ctx.user.userId,
            role: 'user',
            content: input.content,
          },
        });

        yield {
          type: 'user_message',
          message: userMessage,
        };

        // Convert to LLM messages format
        const llmMessages: LLMMessage[] = [
          ...thread.messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
          {
            role: 'user',
            content: input.content,
          },
        ];

        // Import Trinity Mode components
        const { TrinityExecutionManager } = await import('../lib/trinity-manager.js');
        const { DEFAULT_TRINITY_CONFIG, TRINITY_PRESETS } = await import('../lib/trinity-mode.js');
        
        const trinityManager = new TrinityExecutionManager();

        // Determine configuration
        let trinityConfig = DEFAULT_TRINITY_CONFIG;
        if (input.trinityConfig.preset && TRINITY_PRESETS[input.trinityConfig.preset]) {
          trinityConfig = {
            ...DEFAULT_TRINITY_CONFIG,
            ...TRINITY_PRESETS[input.trinityConfig.preset],
            executionMode: input.trinityConfig.executionMode,
          };
        } else if (input.trinityConfig.customConfig) {
          trinityConfig = input.trinityConfig.customConfig;
        } else {
          trinityConfig = {
            ...DEFAULT_TRINITY_CONFIG,
            executionMode: input.trinityConfig.executionMode,
          };
        }

        // Stream Trinity Mode execution
        let assistantMessage: any = null;
        const agentResponses: any[] = [];
        
        for await (const chunk of trinityManager.streamTrinityResponse(llmMessages, trinityConfig)) {
          // Handle agent updates
          if (chunk.type === 'agent_start') {
            yield {
              type: 'agent_start',
              agentType: chunk.agentType,
              timestamp: chunk.timestamp,
            };
          } else if (chunk.type === 'agent_chunk') {
            yield {
              type: 'agent_chunk',
              agentType: chunk.agentType,
              content: chunk.content,
              delta: chunk.delta,
              isComplete: chunk.isComplete,
            };
          } else if (chunk.type === 'agent_complete') {
            agentResponses.push({
              agentType: chunk.agentType,
              content: chunk.content,
              metadata: chunk.metadata,
            });
            
            yield {
              type: 'agent_complete',
              agentType: chunk.agentType,
              content: chunk.content,
              metadata: chunk.metadata,
            };
          } else if (chunk.type === 'orchestrator_chunk') {
            // Create assistant message if not exists
            if (!assistantMessage) {
              assistantMessage = await ctx.prisma.message.create({
                data: {
                  threadId: input.threadId,
                  userId: ctx.user.userId,
                  role: 'assistant',
                  content: '',
                  model: 'trinity-mode',
                  provider: 'trinity',
                },
              });
            }

            // Update message content
            await ctx.prisma.message.update({
              where: { id: assistantMessage.id },
              data: { content: chunk.content },
            });

            yield {
              type: 'orchestrator_chunk',
              messageId: assistantMessage.id,
              content: chunk.content,
              delta: chunk.delta,
            };

            // Note: WebSocket broadcasting would be implemented here
            // if webSocketManager was available
          } else if (chunk.type === 'trinity_complete') {
            if (assistantMessage) {
              // Final update
              await ctx.prisma.message.update({
                where: { id: assistantMessage.id },
                data: {
                  content: chunk.content,
                },
              });
            }

            yield {
              type: 'trinity_complete',
              messageId: assistantMessage?.id,
              content: chunk.content,
              agentResponses,
            };
          }
        }

      } catch (error) {
        console.error('Trinity streaming error:', error);
        yield {
          type: 'error',
          error: error instanceof Error ? error.message : 'Trinity streaming failed',
        };
      }
    }),

  // Get Trinity Mode presets
  getTrinityPresets: authenticatedProcedure
    .query(async ({ ctx }) => {
      const { TRINITY_PRESETS, DEFAULT_TRINITY_CONFIG } = await import('../lib/trinity-mode.js');
      
      return {
        defaultConfig: DEFAULT_TRINITY_CONFIG,
        presets: Object.entries(TRINITY_PRESETS).map(([key, preset]) => ({
          id: key,
          name: key.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          config: preset,
        })),
      };
    }),

  // Validate Trinity Mode configuration
  validateTrinityConfig: authenticatedProcedure
    .input(z.any())
    .query(async ({ input, ctx }) => {
      const { TrinityConfigSchema } = await import('../lib/trinity-mode.js');
      
      try {
        TrinityConfigSchema.parse(input);
        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          errors: error instanceof Error ? error.message : 'Invalid configuration',
        };
      }
    }),

  // Enhanced Thread History Endpoints
  
  // Get comprehensive thread history with pagination and sync support
  getThreadHistory: authenticatedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
      includeBranches: z.boolean().default(false),
      since: z.date().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { user } = ctx;
      
      const options: ThreadHistoryOptions = {
        userId: user.userId,
        limit: input.limit,
        ...(input.cursor && { cursor: input.cursor }),
        includeBranches: input.includeBranches,
        ...(input.since && { since: input.since }),
      };

      return await getThreadHistory(options);
    }),

  // Get threads updated since a specific timestamp (for synchronization)
  getUpdatedThreads: authenticatedProcedure
    .input(z.object({
      since: z.date(),
    }))
    .query(async ({ input, ctx }) => {
      const { user } = ctx;
      
      return await getUpdatedThreadsSince(user.userId, input.since);
    }),

  // Get a specific thread with all messages (enhanced version)
  getThreadDetails: authenticatedProcedure
    .input(z.object({
      threadId: ThreadIdSchema,
      messageLimit: z.number().min(1).max(200).default(50),
      messageCursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { user } = ctx;
      
      return await getThreadWithMessages(
        input.threadId,
        user.userId,
        input.messageLimit,
        input.messageCursor
      );
    }),

  // Enhanced thread search with content search
  searchThreadsAdvanced: authenticatedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input, ctx }) => {
      const { user } = ctx;
      
      return await searchThreads(user.userId, input.query, input.limit);
    }),

  // Get thread statistics for user
  getThreadStatistics: authenticatedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx;
      
      return await getThreadStats(user.userId);
    }),

  // Update user's last sync timestamp
  updateLastSync: authenticatedProcedure
    .mutation(async ({ ctx }) => {
      const { user } = ctx;
      
      await updateUserLastSync(user.userId);
      return { success: true, timestamp: new Date() };
    }),

  // Get user's last sync timestamp
  getLastSync: authenticatedProcedure
    .query(async ({ ctx }) => {
      const { user } = ctx;
      
      const lastSync = await getUserLastSync(user.userId);
      return { lastSyncedAt: lastSync };
    }),

  // Synchronize user data (get all changes since last sync)
  synchronizeData: authenticatedProcedure
    .input(z.object({
      lastSyncedAt: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user } = ctx;
      
      // Get user's last sync if not provided
      const lastSync = input.lastSyncedAt || await getUserLastSync(user.userId);
      
      if (!lastSync) {
        // First sync - return recent data
        const recentData = await getThreadHistory({
          userId: user.userId,
          limit: 50,
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        });
        
        // Update sync timestamp
        await updateUserLastSync(user.userId);
        
        return {
          isFirstSync: true,
          threads: recentData.threads,
          stats: await getThreadStats(user.userId),
          syncedAt: new Date(),
        };
      }
      
      // Get updates since last sync
      const updatedThreads = await getUpdatedThreadsSince(user.userId, lastSync);
      
      // Update sync timestamp
      await updateUserLastSync(user.userId);
      
      return {
        isFirstSync: false,
        updatedThreads,
        stats: await getThreadStats(user.userId),  
        syncedAt: new Date(),
        lastSyncedAt: lastSync,
      };
    }),

  // Thread updates subscription for real-time updates
  threadUpdates: authenticatedProcedure
    .input(z.object({
      threadIds: z.array(ThreadIdSchema).optional(),
    }))
    .subscription(({ input, ctx }) => {
      const { user } = ctx;
      
      return observable<{
        type: 'thread_created' | 'thread_updated' | 'thread_deleted' | 'message_added';
        threadId: string;
        data: any;
      }>((emit) => {
        console.log(`Starting thread updates subscription for user ${user.userId}`);

        // This would be integrated with the actual database change events
        // For now, this is a placeholder
        const mockUpdate = () => {
          emit.next({
            type: 'thread_updated',
            threadId: input.threadIds?.[0] || 'demo-thread-id',
            data: { title: 'Updated thread title' },
          });
        };

        const interval = setInterval(mockUpdate, 5000);

        return () => {
          console.log(`Cleaning up thread updates subscription for user ${user.userId}`);
          clearInterval(interval);
        };
      });
    }),

  // Add memory cards operations
  addMemoryCard: authenticatedProcedure
    .input(z.object({
      threadId: ThreadIdSchema,
      content: MessageContentSchema,
      model: z.string(),
      provider: ModelProviderSchema,
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().min(1).max(4096).default(2048),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      // Verify thread access
      const thread = await prisma.thread.findFirst({
        where: {
          id: input.threadId,
          userId: user.userId,
        },
      });

      if (!thread) {
        throw new Error('Thread not found or access denied');
      }

      // Validate model for provider
      if (!validateModelForProvider(input.provider as LLMProvider, input.model)) {
        throw new Error(`Invalid model ${input.model} for provider ${input.provider}`);
      }

      // Get user's API key for the provider
      const apiKey = await getUserApiKey(user.userId, input.provider as LLMProvider, prisma);
      if (!apiKey) {
        throw new Error(`No API key found for provider ${input.provider}. Please add your API key in settings.`);
      }

      // Create the user message first
      const userMessage = await prisma.message.create({
        data: {
          threadId: input.threadId,
          userId: user.userId,
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

      // Create placeholder assistant message
      const assistantMessage = await prisma.message.create({
        data: {
          threadId: input.threadId,
          userId: user.userId,
          content: '', // Will be updated via streaming
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

      // Start streaming response in the background
      setImmediate(async () => {
        try {
          // Get conversation history
          const previousMessages = await prisma.message.findMany({
            where: { threadId: input.threadId },
            orderBy: { createdAt: 'asc' },
            take: 20, // Limit context window
          });

          // Convert to LLM format
          const llmMessages: LLMMessage[] = previousMessages
            .filter(msg => msg.content.trim()) // Filter out empty messages
            .map(msg => ({
              role: msg.role as 'user' | 'assistant' | 'system',
              content: msg.content,
            }));

          // 🧠 MEMORY-CARDS INTEGRATION: Retrieve contextual memories
          let memoryContext = '';
          try {
            // Get user's OpenAI API key for embeddings
            const openAIKey = await getUserApiKey(user.userId, 'openai', prisma);
            
            const memoryOptions: MemoryRetrievalOptions = {
              userId: user.userId,
              query: input.content,
              limit: 5,
              threshold: 0.3,
            };
            
            if (openAIKey) {
              memoryOptions.apiKey = openAIKey;
            }
            
            const memoryResults = await retrieveContextualMemories(memoryOptions);
            
            if (memoryResults.memoryCount > 0) {
              memoryContext = memoryResults.contextPrompt;
              console.log(`Retrieved ${memoryResults.memoryCount} relevant memories for user ${user.userId}`);
            }
          } catch (error) {
            console.error('Error retrieving contextual memories:', error);
            // Continue without memories if there's an error
          }

          // Add memory context to the beginning of conversation if available
          if (memoryContext) {
            // Add a system message that instructs the AI to use the memories
            llmMessages.unshift({
              role: 'system',
              content: `You are a helpful AI assistant with access to the user's personal memory cards. Use the following memories to provide personalized and contextual responses. These memories contain important information about the user that you should reference when relevant.\n${memoryContext}`,
            });
          }

          // Generate streaming response
          const streamGenerator = generateLLMStreamResponse(llmMessages, {
            model: input.model,
            provider: input.provider as LLMProvider,
            apiKey,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            stream: true,
          });

          let accumulatedContent = '';
          
          for await (const chunk of streamGenerator) {
            accumulatedContent = chunk.content;

            // Send real-time update via WebSocket/SSE
            streamingUtils.sendToUser(user.userId, {
              type: 'chat_response',
              id: `stream_${assistantMessage.id}_${Date.now()}`,
              threadId: input.threadId,
              userId: user.userId,
              data: {
                messageId: assistantMessage.id,
                content: chunk.content,
                delta: chunk.delta,
                role: 'assistant',
                model: input.model,
                provider: input.provider,
                isComplete: chunk.isComplete,
                usage: chunk.usage,
              },
              timestamp: Date.now(),
            });
          }

          // Update the assistant message with final content
          await prisma.message.update({
            where: { id: assistantMessage.id },
            data: { 
              content: accumulatedContent,
              updatedAt: new Date(),
            },
          });

          // 🧠 MEMORY-CARDS INTEGRATION: Analyze and create memory if auto-enabled
          if (accumulatedContent && input.autoMemoryEnabled) {
            try {
              // Analyze conversation for memory creation
              const analysis = await analyzeConversationForMemory(
                llmMessages.slice(-10), // Last 10 messages for context
                accumulatedContent
              );
              
              if (analysis.shouldCreateMemory && analysis.memoryTitle) {
                const memoryCardId = await createMemoryFromConversation(
                  user.userId,
                  analysis,
                  input.threadId
                );
                
                if (memoryCardId) {
                  console.log(`Auto-created memory card: ${memoryCardId}`);
                  
                  // Send notification via streaming
                  streamingUtils.sendToUser(user.userId, {
                    type: 'memory_created',
                    id: `memory_${memoryCardId}`,
                    threadId: input.threadId,
                    userId: user.userId,
                    data: {
                      memoryCardId,
                      title: analysis.memoryTitle,
                      confidence: analysis.confidence,
                    },
                    timestamp: Date.now(),
                  });
                }
              }
            } catch (error) {
              console.error('Error in auto-memory creation:', error);
              // Don't fail the message if memory creation fails
            }
          }

          // Send completion message
          streamingUtils.sendToUser(user.userId, {
            type: 'chat_complete',
            id: `complete_${assistantMessage.id}`,
            threadId: input.threadId,
            userId: user.userId,
            data: {
              messageId: assistantMessage.id,
              content: accumulatedContent,
              role: 'assistant',
              model: input.model,
              provider: input.provider,
              isComplete: true,
            },
            timestamp: Date.now(),
          });

        } catch (error) {
          console.error('LLM streaming error:', error);
          
          // Update message with error
          await prisma.message.update({
            where: { id: assistantMessage.id },
            data: { 
              content: `Error: ${error instanceof Error ? error.message : 'Failed to generate response'}`,
              updatedAt: new Date(),
            },
          });

          // Send error message via streaming
          streamingUtils.sendToUser(user.userId, {
            type: 'error',
            id: `error_${assistantMessage.id}`,
            threadId: input.threadId,
            userId: user.userId,
            data: {
              messageId: assistantMessage.id,
              error: error instanceof Error ? error.message : 'Failed to generate response',
            },
            timestamp: Date.now(),
          });
        }
      });

      return { 
        userMessage,
        assistantMessage,
      };
    }),
}); 