import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc/init.js';
import { TRPCError } from '@trpc/server';
import {
  searchSimilarMemoryCards,
  searchSimilarMemoryCardsDotProduct,
  searchSimilarMemoryCardsL2,
  createMemoryCard,
  updateMemoryCardEmbedding,
  getMemoryCardsWithoutEmbeddings,
  batchUpdateEmbeddings,
  type MemoryCardSearchResult,
  type SimilaritySearchOptions,
} from '../lib/vector-search.js';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  type EmbeddingResult,
  type BatchEmbeddingResult,
} from '../lib/embeddings.js';
import { createMemoryFromConversation } from '../lib/memory-integration.js';
import { analyzeConversationForMemory } from '../lib/memory-integration.js';
import { getUserApiKey } from '../lib/llm.js';

// Input validation schemas
const MemoryCardContentSchema = z.string().min(1).max(10000);
const MemoryCardTitleSchema = z.string().min(1).max(200);
const SimilarityThresholdSchema = z.number().min(0).max(1).default(0.7);
const DistanceMetricSchema = z.enum(['cosine', 'dotProduct', 'l2']).default('cosine');

export const memoryCardsRouter = router({
  // Create a new memory card
  create: authenticatedProcedure
    .input(z.object({
      title: MemoryCardTitleSchema,
      content: MemoryCardContentSchema,
      summary: z.string().optional(),
      metadata: z.record(z.any()).optional(),
      generateEmbedding: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      try {
        let embedding: number[] | undefined;
        
        if (input.generateEmbedding) {
          // Get user's OpenAI API key
          const userApiKey = await getUserApiKey(user.userId, 'openai', prisma);
          if (!userApiKey) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'OpenAI API key not found. Please add your OpenAI API key in settings.',
            });
          }
          
          // Generate embedding for the text
          const textToEmbed = input.summary || input.content;
          embedding = await generateEmbedding(textToEmbed, userApiKey);
        }

        // Create the memory card
        const memoryCard = await createMemoryCard({
          userId: user.userId,
          title: input.title,
          content: input.content,
          summary: input.summary,
          embedding,
          metadata: input.metadata,
        });

        return {
          memoryCard,
          embeddingGenerated: input.generateEmbedding,
        };
      } catch (error) {
        console.error('Error creating memory card:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create memory card',
        });
      }
    }),

  // Batch create multiple memory cards with efficient embedding generation
  createBatch: authenticatedProcedure
    .input(z.object({
      memoryCards: z.array(z.object({
        title: MemoryCardTitleSchema,
        content: MemoryCardContentSchema,
        summary: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })).min(1).max(16), // Limit to embedding batch size
      generateEmbeddings: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      try {
        let embeddings: number[][] | null = null;
        
        if (input.generateEmbeddings) {
          // Get user's OpenAI API key
          const userApiKey = await getUserApiKey(user.userId, 'openai', prisma);
          if (!userApiKey) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'OpenAI API key not found. Please add your OpenAI API key in settings.',
            });
          }
          
          // Generate embeddings in batch for efficiency
          const textsToEmbed = input.memoryCards.map(card => card.summary || card.content);
          const embeddingResults = await generateEmbeddingsBatch(textsToEmbed, userApiKey);
          embeddings = embeddingResults.results.map(result => result.embedding);
        }

        // Create memory cards with embeddings
        const createdCards = await Promise.all(
          input.memoryCards.map(async (cardData, index) => {
            const embedding = embeddings ? embeddings[index] : null;
            
            return await createMemoryCard({
              userId: user.userId,
              title: cardData.title,
              content: cardData.content,
              summary: cardData.summary,
              embedding,
              metadata: cardData.metadata,
            });
          })
        );

        return {
          memoryCards: createdCards,
          embeddingsGenerated: input.generateEmbeddings,
          count: createdCards.length,
        };
      } catch (error) {
        console.error('Error creating memory cards batch:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create memory cards batch',
        });
      }
    }),

  // Get memory cards for the authenticated user
  list: authenticatedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      try {
        const whereConditions: any = {
          userId: user.userId,
        };

        // Add cursor-based pagination
        if (input.cursor) {
          whereConditions.id = {
            lt: input.cursor
          };
        }

        // Add search functionality
        if (input.search) {
          whereConditions.OR = [
            {
              title: {
                contains: input.search,
                mode: 'insensitive'
              }
            },
            {
              content: {
                contains: input.search,
                mode: 'insensitive'
              }
            },
            {
              summary: {
                contains: input.search,
                mode: 'insensitive'
              }
            }
          ];
        }

        const memoryCards = await prisma.memoryCard.findMany({
          where: whereConditions,
          orderBy: { createdAt: 'desc' },
          take: input.limit + 1, // Take one extra to check if there are more
          select: {
            id: true,
            title: true,
            content: true,
            summary: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
            // Don't return embedding vector for performance
          }
        });

        // Check if there are more results
        const hasMore = memoryCards.length > input.limit;
        const resultCards = hasMore ? memoryCards.slice(0, input.limit) : memoryCards;
        const nextCursor = hasMore ? resultCards[resultCards.length - 1].id : undefined;

        return {
          memoryCards: resultCards,
          nextCursor,
          hasMore,
        };
      } catch (error) {
        console.error('Error listing memory cards:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve memory cards',
        });
      }
    }),

  // Get a specific memory card by ID
  get: authenticatedProcedure
    .input(z.object({
      id: z.string().cuid(),
    }))
    .query(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      try {
        const memoryCard = await prisma.memoryCard.findFirst({
          where: {
            id: input.id,
            userId: user.userId, // Ensure user owns the memory card
          },
          select: {
            id: true,
            title: true,
            content: true,
            summary: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
            // Don't return embedding vector for performance unless specifically needed
          }
        });

        if (!memoryCard) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Memory card not found',
          });
        }

        return { memoryCard };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Error getting memory card:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve memory card',
        });
      }
    }),

  // Search for similar memory cards using vector similarity
  searchSimilar: authenticatedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(10),
      threshold: SimilarityThresholdSchema,
      metric: DistanceMetricSchema,
      excludeIds: z.array(z.string()).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      try {
        // Generate embedding for the search query
        const queryEmbedding = await generateEmbedding(input.query);

        // Search options
        const searchOptions: SimilaritySearchOptions = {
          limit: input.limit,
          threshold: input.threshold,
          userId: user.userId,
          ...(input.excludeIds && { excludeIds: input.excludeIds }),
        };

        // Perform similarity search based on chosen metric
        let results: MemoryCardSearchResult[];
        
        switch (input.metric) {
          case 'cosine':
            results = await searchSimilarMemoryCards(queryEmbedding, searchOptions);
            break;
          case 'dotProduct':
            results = await searchSimilarMemoryCardsDotProduct(queryEmbedding, searchOptions);
            break;
          case 'l2':
            results = await searchSimilarMemoryCardsL2(queryEmbedding, searchOptions);
            break;
          default:
            results = await searchSimilarMemoryCards(queryEmbedding, searchOptions);
        }

        return {
          results,
          query: input.query,
          metric: input.metric,
          threshold: input.threshold,
          count: results.length,
        };
      } catch (error) {
        console.error('Error searching similar memory cards:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to search memory cards',
        });
      }
    }),

  // Update a memory card
  update: authenticatedProcedure
    .input(z.object({
      id: z.string().cuid(),
      title: MemoryCardTitleSchema.optional(),
      content: MemoryCardContentSchema.optional(),
      summary: z.string().optional(),
      metadata: z.record(z.any()).optional(),
      regenerateEmbedding: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      try {
        // Verify ownership
        const existingCard = await prisma.memoryCard.findFirst({
          where: {
            id: input.id,
            userId: user.userId,
          }
        });

        if (!existingCard) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Memory card not found',
          });
        }

        // Prepare update data
        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.title !== undefined) updateData.title = input.title;
        if (input.content !== undefined) updateData.content = input.content;
        if (input.summary !== undefined) updateData.summary = input.summary;
        if (input.metadata !== undefined) updateData.metadata = input.metadata;

        // Regenerate embedding if requested or if content changed
        if (input.regenerateEmbedding || input.content !== undefined || input.summary !== undefined) {
          const textToEmbed = input.summary !== undefined ? input.summary : 
                            input.content !== undefined ? input.content :
                            existingCard.summary || existingCard.content;
          
          const newEmbedding = await generateEmbedding(textToEmbed);
          await updateMemoryCardEmbedding(input.id, newEmbedding);
        }

        // Update the memory card
        const updatedCard = await prisma.memoryCard.update({
          where: { id: input.id },
          data: updateData,
          select: {
            id: true,
            title: true,
            content: true,
            summary: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
          }
        });

        return {
          memoryCard: updatedCard,
          embeddingRegenerated: input.regenerateEmbedding || input.content !== undefined || input.summary !== undefined,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Error updating memory card:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update memory card',
        });
      }
    }),

  // Delete a memory card
  delete: authenticatedProcedure
    .input(z.object({
      id: z.string().cuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      try {
        // Verify ownership and delete
        const deletedCard = await prisma.memoryCard.deleteMany({
          where: {
            id: input.id,
            userId: user.userId,
          }
        });

        if (deletedCard.count === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Memory card not found',
          });
        }

        return {
          success: true,
          deletedId: input.id,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Error deleting memory card:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete memory card',
        });
      }
    }),

  // Get memory cards that need embeddings (for batch processing)
  getWithoutEmbeddings: authenticatedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const { user } = ctx;

      try {
        const cardsWithoutEmbeddings = await getMemoryCardsWithoutEmbeddings(user.userId, input.limit);
        
        return {
          memoryCards: cardsWithoutEmbeddings,
          count: cardsWithoutEmbeddings.length,
        };
      } catch (error) {
        console.error('Error getting memory cards without embeddings:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve memory cards without embeddings',
        });
      }
    }),

  // Batch update embeddings for memory cards that don't have them
  batchUpdateEmbeddings: authenticatedProcedure
    .input(z.object({
      memoryCardIds: z.array(z.string().cuid()).optional(),
      limit: z.number().min(1).max(16).default(16), // Match OpenAI batch size
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      try {
        let cardsToProcess;
        
        if (input.memoryCardIds && input.memoryCardIds.length > 0) {
          // Process specific memory cards
          cardsToProcess = await prisma.memoryCard.findMany({
            where: {
              id: { in: input.memoryCardIds },
              userId: user.userId,
            },
            select: {
              id: true,
              content: true,
              summary: true,
            },
            take: input.limit,
          });
        } else {
          // Get cards without embeddings
          cardsToProcess = await getMemoryCardsWithoutEmbeddings(user.userId, input.limit);
        }

        if (cardsToProcess.length === 0) {
          return {
            updated: 0,
            message: 'No memory cards found to update',
          };
        }

        // Generate embeddings in batch
        const textsToEmbed = cardsToProcess.map(card => card.summary || card.content);
        const embeddingResults = await generateEmbeddingsBatch(textsToEmbed);

        // Update embeddings using our batch update function
        const updateData = cardsToProcess.map((card, index) => ({
          id: card.id,
          embedding: embeddingResults.results[index].embedding,
        }));

        await batchUpdateEmbeddings(updateData);

        return {
          updated: updateData.length,
          totalTokens: embeddingResults.totalTokens,
          model: embeddingResults.model,
        };
      } catch (error) {
        console.error('Error batch updating embeddings:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to batch update embeddings',
        });
      }
    }),

  // Get memory card statistics for the user
  getStats: authenticatedProcedure
    .query(async ({ ctx }) => {
      const { user, prisma } = ctx;

      try {
        const [totalCards, cardsWithEmbeddingsResult, recentCards] = await Promise.all([
          prisma.memoryCard.count({
            where: { userId: user.userId }
          }),
          // Use raw query to count cards with embeddings
          prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*)::bigint as count 
            FROM memory_cards 
            WHERE "userId" = ${user.userId} 
            AND embedding IS NOT NULL
          `,
          prisma.memoryCard.count({
            where: {
              userId: user.userId,
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
              }
            }
          })
        ]);

        const cardsWithEmbeddings = Number(cardsWithEmbeddingsResult[0].count);
        const embeddingCoverage = totalCards > 0 ? (cardsWithEmbeddings / totalCards) * 100 : 0;

        return {
          totalCards,
          cardsWithEmbeddings,
          cardsWithoutEmbeddings: totalCards - cardsWithEmbeddings,
          embeddingCoverage: Math.round(embeddingCoverage * 100) / 100, // Round to 2 decimal places
          recentCards,
        };
      } catch (error) {
        console.error('Error getting memory card stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve memory card statistics',
        });
      }
    }),

  // Create memory card from conversation summary
  createFromConversation: authenticatedProcedure
    .input(z.object({
      threadId: z.string(),
      conversationText: z.string(),
      generateEmbedding: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      try {
        // Get user's OpenAI API key
        const userApiKey = await getUserApiKey(user.userId, 'openai', prisma);
        if (!userApiKey) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'OpenAI API key not found. Please add your OpenAI API key in settings.',
          });
        }

        // Generate a summary using LLM
        const { generateLLMResponse } = await import('../lib/llm.js');
        
        const summaryResponse = await generateLLMResponse([
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, informative summaries of conversations. Focus on key points, decisions made, and important information discussed.'
          },
          {
            role: 'user',
            content: `Please create a concise summary of the following conversation, highlighting the main topics, key insights, and any important decisions or action items:\n\n${input.conversationText}`
          }
        ], {
          model: 'gpt-4o-mini',
          provider: 'openai',
          apiKey: userApiKey,
          maxTokens: 500,
          temperature: 0.7,
          stream: false,
        });

        const summary = summaryResponse.content;
        
        // Generate a title for the memory card
        const titleResponse = await generateLLMResponse([
          {
            role: 'system',
            content: 'You are a helpful assistant that creates short, descriptive titles (max 60 characters).'
          },
          {
            role: 'user',
            content: `Create a short title for this conversation summary:\n\n${summary}`
          }
        ], {
          model: 'gpt-4o-mini',
          provider: 'openai',
          apiKey: userApiKey,
          maxTokens: 50,
          temperature: 0.7,
          stream: false,
        });

        const title = titleResponse.content.substring(0, 60);

        // Generate embedding if requested
        let embedding: number[] | undefined;
        if (input.generateEmbedding) {
          embedding = await generateEmbedding(summary, userApiKey);
        }

        // Create the memory card
        const memoryCard = await createMemoryCard({
          userId: user.userId,
          title,
          content: summary,
          summary: summary,
          embedding,
          metadata: {
            threadId: input.threadId,
            autoGenerated: true,
            source: 'manual_summarize',
            createdAt: new Date().toISOString(),
          },
        });

        return {
          memoryCard,
          embeddingGenerated: input.generateEmbedding,
        };
      } catch (error) {
        console.error('Error creating memory from conversation:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create memory from conversation',
        });
      }
    }),
}); 