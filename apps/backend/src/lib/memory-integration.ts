import { generateEmbedding } from './embeddings.js';
import { searchSimilarMemoryCards, createMemoryCard } from './vector-search.js';
import type { LLMMessage } from './llm.js';
import { prisma } from './database.js';

/**
 * Interface for memory retrieval options
 */
export interface MemoryRetrievalOptions {
  userId: string;
  query: string;
  limit?: number;
  threshold?: number;
  excludeThreadId?: string;
  apiKey?: string;
}

/**
 * Interface for contextual memory results
 */
export interface ContextualMemoryResult {
  memories: Array<{
    id: string;
    title: string;
    content: string;
    summary?: string;
    similarity: number;
    relevance: 'high' | 'medium' | 'low';
  }>;
  contextPrompt: string;
  memoryCount: number;
}

/**
 * Interface for conversation analysis
 */
export interface ConversationAnalysis {
  shouldCreateMemory: boolean;
  memoryTitle?: string;
  memorySummary?: string;
  keyPoints: string[];
  confidence: number;
}

/**
 * Retrieve relevant Memory-Cards based on conversation context
 * @param options - Memory retrieval options
 * @returns Promise<ContextualMemoryResult> - Relevant memories and context
 */
export async function retrieveContextualMemories(
  options: MemoryRetrievalOptions
): Promise<ContextualMemoryResult> {
  const {
    userId,
    query,
    limit = 5,
    threshold = 0.75,
    apiKey,
  } = options;

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query, apiKey);

    // Search for similar memory cards
    const searchResults = await searchSimilarMemoryCards(queryEmbedding, {
      userId,
      limit,
      threshold,
    });

    // Process and categorize memories by relevance
    const memories = searchResults.map(result => {
      let relevance: 'high' | 'medium' | 'low' = 'low';
      
      if (result.similarity >= 0.7) {
        relevance = 'high';
      } else if (result.similarity >= 0.5) {
        relevance = 'medium';
      }

      const memory: ContextualMemoryResult['memories'][0] = {
        id: result.id,
        title: result.title,
        content: result.content,
        similarity: result.similarity,
        relevance,
      };
      
      // Only add summary if it exists
      if (result.summary) {
        memory.summary = result.summary;
      }
      
      return memory;
    });

    // Generate context prompt for LLM
    const contextPrompt = generateContextPrompt(memories);

    return {
      memories,
      contextPrompt,
      memoryCount: memories.length,
    };
  } catch (error) {
    console.error('Error retrieving contextual memories:', error);
    return {
      memories: [],
      contextPrompt: '',
      memoryCount: 0,
    };
  }
}

/**
 * Generate a context prompt from relevant memories
 * @param memories - Array of relevant memories
 * @returns string - Formatted context prompt
 */
function generateContextPrompt(memories: ContextualMemoryResult['memories']): string {
  if (memories.length === 0) {
    return '';
  }

  let relevantMemories = memories
    .filter(memory => memory.relevance === 'high' || memory.relevance === 'medium')
    .slice(0, 3); // Limit to top 3 for context window efficiency

  // If no high/medium relevance memories, include low relevance ones
  if (relevantMemories.length === 0) {
    relevantMemories = memories
      .filter(memory => memory.relevance === 'low')
      .slice(0, 3);
  }

  if (relevantMemories.length === 0) {
    return '';
  }

  let contextPrompt = '\n\n--- RELEVANT MEMORIES ---\n';
  contextPrompt += 'Here are some relevant memories from previous conversations that may help provide better context:\n\n';

  relevantMemories.forEach((memory, index) => {
    contextPrompt += `Memory ${index + 1}: ${memory.title}\n`;
    if (memory.summary) {
      contextPrompt += `Summary: ${memory.summary}\n`;
    } else {
      // Truncate content if no summary
      const truncatedContent = memory.content.length > 200 
        ? memory.content.substring(0, 200) + '...'
        : memory.content;
      contextPrompt += `Content: ${truncatedContent}\n`;
    }
    contextPrompt += `Relevance: ${memory.relevance} (${(memory.similarity * 100).toFixed(1)}% match)\n\n`;
  });

  contextPrompt += 'Please use these memories to provide more contextual and personalized responses.\n';
  contextPrompt += '--- END MEMORIES ---\n\n';

  return contextPrompt;
}

/**
 * Analyze a conversation to determine if a memory should be created
 */
export async function analyzeConversationForMemory(
  messages: any[],
  latestResponse: string
): Promise<{
  shouldCreateMemory: boolean;
  memoryTitle?: string;
  memoryContent?: string;
  confidence: number;
  tags?: string[];
}> {
  try {
    // Simple heuristic-based analysis for MVP
    // In production, this would use LLM to analyze the conversation
    
    // Look for key indicators in the latest response
    const indicators = [
      /I'll remember/i,
      /I understand that/i,
      /noted that/i,
      /important to know/i,
      /key point/i,
      /main takeaway/i,
      /summary/i,
      /in conclusion/i,
    ];
    
    const hasIndicator = indicators.some(pattern => pattern.test(latestResponse));
    
    // Check if the response is substantive enough
    const wordCount = latestResponse.split(/\s+/).length;
    const hasSubstance = wordCount > 50;
    
    // Check for specific content types
    const hasCode = /```[\s\S]*```/.test(latestResponse);
    const hasLinks = /https?:\/\//.test(latestResponse);
    const hasBulletPoints = /^[\s]*[-*•]/m.test(latestResponse);
    
    // Calculate confidence based on indicators
    let confidence = 0;
    if (hasIndicator) confidence += 0.3;
    if (hasSubstance) confidence += 0.2;
    if (hasCode) confidence += 0.2;
    if (hasLinks) confidence += 0.1;
    if (hasBulletPoints) confidence += 0.2;
    
    const shouldCreateMemory = confidence >= 0.5;
    
    if (shouldCreateMemory) {
      // Extract a title from the conversation
      const userMessage = messages[messages.length - 2]?.content || '';
      const titleMatch = userMessage.match(/^(.{1,60})/);
      const memoryTitle = titleMatch ? titleMatch[1].trim() + '...' : 'Conversation Memory';
      
      // Extract key content
      const memoryContent = latestResponse.length > 500 
        ? latestResponse.substring(0, 500) + '...'
        : latestResponse;
      
      // Generate tags based on content
      const tags: string[] = [];
      if (hasCode) tags.push('code');
      if (hasLinks) tags.push('resources');
      if (hasBulletPoints) tags.push('list');
      
      return {
        shouldCreateMemory: true,
        memoryTitle,
        memoryContent,
        confidence,
        tags,
      };
    }
    
    return {
      shouldCreateMemory: false,
      confidence,
    };
  } catch (error) {
    console.error('Error analyzing conversation for memory:', error);
    return {
      shouldCreateMemory: false,
      confidence: 0,
    };
  }
}

/**
 * Create a memory card from conversation analysis
 */
export async function createMemoryFromConversation(
  userId: string,
  analysis: {
    memoryTitle?: string;
    memoryContent?: string;
    tags?: string[];
    confidence: number;
  },
  threadId: string
): Promise<string | null> {
  try {
    if (!analysis.memoryTitle || !analysis.memoryContent) {
      return null;
    }
    
    const memoryCard = await prisma.memoryCard.create({
      data: {
        userId,
        title: analysis.memoryTitle,
        content: analysis.memoryContent,
        metadata: {
          threadId,
          autoGenerated: true,
          confidence: analysis.confidence,
          tags: analysis.tags || [],
          createdAt: new Date().toISOString(),
        },
      },
    });
    
    // Generate embeddings for the memory card
    try {
      const embedding = await generateEmbedding(analysis.memoryContent);
      
      // PgVector doesn't support direct update of vector fields via Prisma
      // We need to use raw SQL or handle it differently
      console.log('Embedding generated for memory card:', memoryCard.id);
      // TODO: Update embedding using raw SQL or vector-search service
    } catch (embeddingError) {
      console.error('Error generating embedding for memory card:', embeddingError);
      // Continue without embedding - it can be generated later
    }
    
    return memoryCard.id;
  } catch (error) {
    console.error('Error creating memory from conversation:', error);
    return null;
  }
} 