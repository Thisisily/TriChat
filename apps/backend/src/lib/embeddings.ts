import { OpenAI } from 'openai';

// Configuration for embeddings
const EMBEDDING_MODEL = process.env['EMBEDDING_MODEL'] || 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = parseInt(process.env['EMBEDDING_DIMENSIONS'] || '1536');
const BATCH_SIZE = parseInt(process.env['BATCH_SIZE'] || '16');
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Interface for embedding results
 */
export interface EmbeddingResult {
  text: string;
  embedding: number[];
  index: number;
}

/**
 * Interface for batch embedding results
 */
export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokens: number;
  model: string;
}

/**
 * Create OpenAI client with the provided API key
 */
function createOpenAIClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env['OPENAI_API_KEY'];
  if (!key) {
    throw new Error('OpenAI API key not provided');
  }
  return new OpenAI({ apiKey: key });
}

/**
 * Generate embeddings for a single text
 * @param text - The text to embed
 * @param apiKey - Optional API key to use (defaults to env var)
 * @returns Promise<number[]> - The embedding vector
 */
export async function generateEmbedding(text: string, apiKey?: string): Promise<number[]> {
  try {
    const openai = createOpenAIClient(apiKey);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    if (!response.data[0]?.embedding) {
      throw new Error('No embedding returned from OpenAI API');
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings for multiple texts in batches
 * @param texts - Array of texts to embed
 * @param apiKey - Optional API key to use (defaults to env var)
 * @returns Promise<BatchEmbeddingResult> - The batch embedding results
 */
export async function generateEmbeddingsBatch(texts: string[], apiKey?: string): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    return {
      results: [],
      totalTokens: 0,
      model: EMBEDDING_MODEL,
    };
  }

  const results: EmbeddingResult[] = [];
  let totalTokens = 0;

  // Process texts in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResult = await generateEmbeddingsBatchInternal(batch, i, apiKey);
    
    results.push(...batchResult.results);
    totalTokens += batchResult.totalTokens;
  }

  return {
    results,
    totalTokens,
    model: EMBEDDING_MODEL,
  };
}

/**
 * Internal function to process a single batch of texts
 * @param texts - Batch of texts to embed
 * @param startIndex - Starting index for the batch
 * @param apiKey - Optional API key to use
 * @returns Promise<BatchEmbeddingResult> - The batch results
 */
async function generateEmbeddingsBatchInternal(
  texts: string[], 
  startIndex: number,
  apiKey?: string
): Promise<BatchEmbeddingResult> {
  let lastError: Error | null = null;
  const openai = createOpenAIClient(apiKey);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      const results: EmbeddingResult[] = response.data.map((item: any, index: number) => ({
        text: texts[index] || '',
        embedding: item.embedding,
        index: startIndex + index,
      }));

      return {
        results,
        totalTokens: response.usage.total_tokens,
        model: EMBEDDING_MODEL,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < MAX_RETRIES - 1) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
        console.warn(`Retrying batch embedding (attempt ${attempt + 1}/${MAX_RETRIES}):`, lastError.message);
      }
    }
  }

  throw new Error(`Failed to generate batch embeddings after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Calculate cosine similarity between two vectors
 * @param a - First vector
 * @param b - Second vector
 * @returns number - Cosine similarity score
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Normalize a vector to unit length
 * @param vector - The vector to normalize
 * @returns number[] - The normalized vector
 */
export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  
  if (norm === 0) {
    return vector;
  }

  return vector.map(val => val / norm);
}

/**
 * Convert a vector to the format expected by PgVector
 * @param vector - The vector to format
 * @returns string - The formatted vector string
 */
export function formatVectorForPg(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * Parse a vector from PgVector format
 * @param vectorString - The vector string from PgVector
 * @returns number[] - The parsed vector
 */
export function parseVectorFromPg(vectorString: string): number[] {
  if (!vectorString || vectorString === '') {
    return [];
  }

  // Remove brackets and split by comma
  const cleaned = vectorString.replace(/^\[|\]$/g, '');
  return cleaned.split(',').map(num => parseFloat(num.trim()));
}

/**
 * Validate embedding dimensions
 * @param embedding - The embedding to validate
 * @returns boolean - Whether the embedding is valid
 */
export function validateEmbedding(embedding: number[]): boolean {
  return (
    Array.isArray(embedding) &&
    embedding.length === EMBEDDING_DIMENSIONS &&
    embedding.every(val => typeof val === 'number' && !isNaN(val))
  );
}

/**
 * Get embedding configuration
 * @returns Object with embedding configuration
 */
export function getEmbeddingConfig() {
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    batchSize: BATCH_SIZE,
    maxRetries: MAX_RETRIES,
    retryDelay: RETRY_DELAY,
  };
} 