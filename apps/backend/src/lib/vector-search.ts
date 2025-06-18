import { prisma } from './database';
import { formatVectorForPg, parseVectorFromPg } from './embeddings';

/**
 * Interface for memory card search results
 */
export interface MemoryCardSearchResult {
  id: string;
  userId: string;
  title: string;
  content: string;
  summary: string | null;
  similarity: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for similarity search options
 */
export interface SimilaritySearchOptions {
  limit?: number;
  threshold?: number;
  userId?: string;
  excludeIds?: string[];
}

/**
 * Search for similar memory cards using cosine distance
 * @param queryEmbedding - The query embedding vector
 * @param options - Search options
 * @returns Promise<MemoryCardSearchResult[]> - Array of similar memory cards
 */
export async function searchSimilarMemoryCards(
  queryEmbedding: number[],
  options: SimilaritySearchOptions = {}
): Promise<MemoryCardSearchResult[]> {
  const {
    limit = 5,
    threshold = 0.7,
    userId,
    excludeIds = [],
  } = options;

  const vectorString = formatVectorForPg(queryEmbedding);
  
  // Build the WHERE clause conditions
  const whereConditions: string[] = [];
  const queryParams: any[] = [vectorString, limit];
  
  if (userId) {
    whereConditions.push(`"userId" = $${queryParams.length + 1}`);
    queryParams.push(userId);
  }
  
  if (excludeIds.length > 0) {
    whereConditions.push(`"id" NOT IN (${excludeIds.map((_, i) => `$${queryParams.length + i + 1}`).join(', ')})`);
    queryParams.push(...excludeIds);
  }
  
  // Add the embedding conditions to the where conditions
  whereConditions.push(`"embedding" IS NOT NULL`);
  whereConditions.push(`1 - ("embedding" <=> $1::vector) >= ${threshold}`);
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // Use raw query for vector similarity search with cosine distance
  const query = `
    SELECT 
      "id",
      "userId",
      "title", 
      "content",
      "summary",
      "createdAt",
      "updatedAt",
      1 - ("embedding" <=> $1::vector) as similarity
    FROM "memory_cards"
    ${whereClause}
    ORDER BY "embedding" <=> $1::vector
    LIMIT $2
  `;

  const results = await prisma.$queryRawUnsafe(query, ...queryParams);
  
  return (results as any[]).map(row => ({
    id: row.id,
    userId: row.userId,
    title: row.title,
    content: row.content,
    summary: row.summary,
    similarity: parseFloat(row.similarity),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
}

/**
 * Search for similar memory cards using dot product
 * @param queryEmbedding - The query embedding vector
 * @param options - Search options
 * @returns Promise<MemoryCardSearchResult[]> - Array of similar memory cards
 */
export async function searchSimilarMemoryCardsDotProduct(
  queryEmbedding: number[],
  options: SimilaritySearchOptions = {}
): Promise<MemoryCardSearchResult[]> {
  const {
    limit = 5,
    threshold = 0.7,
    userId,
    excludeIds = [],
  } = options;

  const vectorString = formatVectorForPg(queryEmbedding);
  
  // Build the WHERE clause conditions
  const whereConditions: string[] = [];
  const queryParams: any[] = [vectorString, limit];
  
  if (userId) {
    whereConditions.push(`"userId" = $${queryParams.length + 1}`);
    queryParams.push(userId);
  }
  
  if (excludeIds.length > 0) {
    whereConditions.push(`"id" NOT IN (${excludeIds.map((_, i) => `$${queryParams.length + i + 1}`).join(', ')})`);
    queryParams.push(...excludeIds);
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // Use raw query for vector similarity search with dot product (inner product)
  const query = `
    SELECT 
      "id",
      "userId",
      "title", 
      "content",
      "summary",
      "createdAt",
      "updatedAt",
      ("embedding" <#> $1::vector) * -1 as similarity
    FROM "memory_cards"
    ${whereClause}
    AND "embedding" IS NOT NULL
    AND ("embedding" <#> $1::vector) * -1 >= ${threshold}
    ORDER BY "embedding" <#> $1::vector DESC
    LIMIT $2
  `;

  const results = await prisma.$queryRawUnsafe(query, ...queryParams);
  
  return (results as any[]).map(row => ({
    id: row.id,
    userId: row.userId,
    title: row.title,
    content: row.content,
    summary: row.summary,
    similarity: parseFloat(row.similarity),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
}

/**
 * Search for similar memory cards using L2 (Euclidean) distance
 * @param queryEmbedding - The query embedding vector
 * @param options - Search options
 * @returns Promise<MemoryCardSearchResult[]> - Array of similar memory cards
 */
export async function searchSimilarMemoryCardsL2(
  queryEmbedding: number[],
  options: SimilaritySearchOptions = {}
): Promise<MemoryCardSearchResult[]> {
  const {
    limit = 5,
    threshold = 1.0, // For L2 distance, lower is better
    userId,
    excludeIds = [],
  } = options;

  const vectorString = formatVectorForPg(queryEmbedding);
  
  // Build the WHERE clause conditions
  const whereConditions: string[] = [];
  const queryParams: any[] = [vectorString, limit];
  
  if (userId) {
    whereConditions.push(`"userId" = $${queryParams.length + 1}`);
    queryParams.push(userId);
  }
  
  if (excludeIds.length > 0) {
    whereConditions.push(`"id" NOT IN (${excludeIds.map((_, i) => `$${queryParams.length + i + 1}`).join(', ')})`);
    queryParams.push(...excludeIds);
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // Use raw query for vector similarity search with L2 distance
  const query = `
    SELECT 
      "id",
      "userId",
      "title", 
      "content",
      "summary",
      "createdAt",
      "updatedAt",
      ("embedding" <-> $1::vector) as distance,
      1 / (1 + ("embedding" <-> $1::vector)) as similarity
    FROM "memory_cards"
    ${whereClause}
    AND "embedding" IS NOT NULL
    AND ("embedding" <-> $1::vector) <= ${threshold}
    ORDER BY "embedding" <-> $1::vector
    LIMIT $2
  `;

  const results = await prisma.$queryRawUnsafe(query, ...queryParams);
  
  return (results as any[]).map(row => ({
    id: row.id,
    userId: row.userId,
    title: row.title,
    content: row.content,
    summary: row.summary,
    similarity: parseFloat(row.similarity),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
}

/**
 * Create a new memory card with embedding
 * @param data - Memory card data
 * @returns Promise<string> - The created memory card ID
 */
export async function createMemoryCard(data: {
  userId: string;
  title: string;
  content: string;
  summary?: string;
  embedding: number[];
  metadata?: Record<string, any>;
}): Promise<string> {
  const memoryCard = await prisma.memoryCard.create({
    data: {
      userId: data.userId,
      title: data.title,
      content: data.content,
      summary: data.summary,
      // Use raw SQL to insert the vector
      ...({} as any), // Placeholder for embedding - will use raw query
      metadata: data.metadata,
    },
  });

  // Update with embedding using raw SQL
  const vectorString = formatVectorForPg(data.embedding);
  await prisma.$executeRawUnsafe(
    `UPDATE "memory_cards" SET "embedding" = $1::vector WHERE "id" = $2`,
    vectorString,
    memoryCard.id
  );

  return memoryCard.id;
}

/**
 * Update a memory card's embedding
 * @param id - Memory card ID
 * @param embedding - New embedding vector
 * @returns Promise<void>
 */
export async function updateMemoryCardEmbedding(
  id: string,
  embedding: number[]
): Promise<void> {
  const vectorString = formatVectorForPg(embedding);
  await prisma.$executeRawUnsafe(
    `UPDATE "memory_cards" SET "embedding" = $1::vector, "updatedAt" = NOW() WHERE "id" = $2`,
    vectorString,
    id
  );
}

/**
 * Get memory cards without embeddings
 * @param limit - Maximum number of cards to return
 * @returns Promise<Array> - Memory cards without embeddings
 */
export async function getMemoryCardsWithoutEmbeddings(limit = 100) {
  return prisma.memoryCard.findMany({
    where: {
      embedding: null,
    },
    take: limit,
    orderBy: {
      createdAt: 'asc',
    },
  });
}

/**
 * Batch update embeddings for multiple memory cards
 * @param updates - Array of {id, embedding} pairs
 * @returns Promise<void>
 */
export async function batchUpdateEmbeddings(
  updates: Array<{ id: string; embedding: number[] }>
): Promise<void> {
  // Use a transaction for batch updates
  await prisma.$transaction(
    updates.map(({ id, embedding }) => {
      const vectorString = formatVectorForPg(embedding);
      return prisma.$executeRawUnsafe(
        `UPDATE "memory_cards" SET "embedding" = $1::vector, "updatedAt" = NOW() WHERE "id" = $2`,
        vectorString,
        id
      );
    })
  );
} 