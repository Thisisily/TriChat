import { test, expect, describe, beforeAll, afterAll, mock } from 'bun:test';
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
} from '../lib/vector-search';

// Mock Prisma client
const mockPrisma = {
  $queryRawUnsafe: mock(() => Promise.resolve([])),
  $executeRawUnsafe: mock(() => Promise.resolve({})),
  $transaction: mock((queries: any[]) => Promise.all(queries)),
  memoryCard: {
    create: mock(() => Promise.resolve({ id: 'test-id' })),
    findMany: mock(() => Promise.resolve([])),
  },
};

// Mock the database import
mock.module('../lib/database', () => ({
  prisma: mockPrisma
}));

describe('Vector Search Service', () => {
  const testEmbedding = new Array(1536).fill(0).map(() => Math.random());
  const testUserId = 'user-123';

  beforeAll(() => {
    // Reset all mocks before tests
    mockPrisma.$queryRawUnsafe.mockClear();
    mockPrisma.$executeRawUnsafe.mockClear();
    mockPrisma.memoryCard.create.mockClear();
    mockPrisma.memoryCard.findMany.mockClear();
  });

  afterAll(() => {
    // Clean up after tests
    mockPrisma.$queryRawUnsafe.mockClear();
    mockPrisma.$executeRawUnsafe.mockClear();
  });

  describe('searchSimilarMemoryCards (Cosine Distance)', () => {
    test('should search with default options', async () => {
      const mockResults = [
        {
          id: 'card-1',
          userId: testUserId,
          title: 'Test Card 1',
          content: 'Content 1',
          summary: 'Summary 1',
          similarity: 0.9,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];

      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(mockResults);

      const results = await searchSimilarMemoryCards(testEmbedding);

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBe(0.9);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('1 - ("embedding" <=> $1::vector) as similarity'),
        expect.stringContaining('['),
        5
      );
    });

    test('should search with custom options', async () => {
      const options: SimilaritySearchOptions = {
        limit: 10,
        threshold: 0.8,
        userId: testUserId,
        excludeIds: ['exclude-1', 'exclude-2'],
      };

      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await searchSimilarMemoryCards(testEmbedding, options);

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('WHERE "userId" = $3 AND "id" NOT IN ($4, $5)'),
        expect.stringContaining('['),
        10,
        testUserId,
        'exclude-1',
        'exclude-2'
      );
    });

    test('should handle empty results', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      const results = await searchSimilarMemoryCards(testEmbedding);

      expect(results).toHaveLength(0);
    });

    test('should handle database errors', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(new Error('Database error'));

      await expect(searchSimilarMemoryCards(testEmbedding)).rejects.toThrow('Database error');
    });
  });

  describe('searchSimilarMemoryCardsDotProduct', () => {
    test('should use dot product distance metric', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await searchSimilarMemoryCardsDotProduct(testEmbedding);

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('("embedding" <#> $1::vector) * -1 as similarity'),
        expect.any(String),
        5
      );
    });

    test('should order by dot product descending', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await searchSimilarMemoryCardsDotProduct(testEmbedding);

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY "embedding" <#> $1::vector DESC'),
        expect.any(String),
        5
      );
    });
  });

  describe('searchSimilarMemoryCardsL2', () => {
    test('should use L2 distance metric', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await searchSimilarMemoryCardsL2(testEmbedding);

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('("embedding" <-> $1::vector) as distance'),
        expect.any(String),
        5
      );
    });

    test('should use different threshold for L2', async () => {
      const options: SimilaritySearchOptions = {
        threshold: 0.5,
      };

      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await searchSimilarMemoryCardsL2(testEmbedding, options);

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('("embedding" <-> $1::vector) <= 0.5'),
        expect.any(String),
        5
      );
    });
  });

  describe('createMemoryCard', () => {
    test('should create memory card with embedding', async () => {
      const testData = {
        userId: testUserId,
        title: 'Test Card',
        content: 'Test content',
        summary: 'Test summary',
        embedding: testEmbedding,
        metadata: { tag: 'test' },
      };

      mockPrisma.memoryCard.create.mockResolvedValueOnce({ id: 'new-card-id' });
      mockPrisma.$executeRawUnsafe.mockResolvedValueOnce({});

      const cardId = await createMemoryCard(testData);

      expect(cardId).toBe('new-card-id');
      expect(mockPrisma.memoryCard.create).toHaveBeenCalledWith({
        data: {
          userId: testData.userId,
          title: testData.title,
          content: testData.content,
          summary: testData.summary,
          metadata: testData.metadata,
        },
      });
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        'UPDATE "memory_cards" SET "embedding" = $1::vector WHERE "id" = $2',
        expect.stringContaining('['),
        'new-card-id'
      );
    });

    test('should handle creation without optional fields', async () => {
      const testData = {
        userId: testUserId,
        title: 'Test Card',
        content: 'Test content',
        embedding: testEmbedding,
      };

      mockPrisma.memoryCard.create.mockResolvedValueOnce({ id: 'new-card-id' });
      mockPrisma.$executeRawUnsafe.mockResolvedValueOnce({});

      const cardId = await createMemoryCard(testData);

      expect(cardId).toBe('new-card-id');
      expect(mockPrisma.memoryCard.create).toHaveBeenCalledWith({
        data: {
          userId: testData.userId,
          title: testData.title,
          content: testData.content,
          summary: undefined,
          metadata: undefined,
        },
      });
    });
  });

  describe('updateMemoryCardEmbedding', () => {
    test('should update embedding for existing card', async () => {
      const cardId = 'existing-card-id';
      mockPrisma.$executeRawUnsafe.mockResolvedValueOnce({});

      await updateMemoryCardEmbedding(cardId, testEmbedding);

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        'UPDATE "memory_cards" SET "embedding" = $1::vector, "updatedAt" = NOW() WHERE "id" = $2',
        expect.stringContaining('['),
        cardId
      );
    });

    test('should handle update errors', async () => {
      const cardId = 'existing-card-id';
      mockPrisma.$executeRawUnsafe.mockRejectedValueOnce(new Error('Update failed'));

      await expect(updateMemoryCardEmbedding(cardId, testEmbedding)).rejects.toThrow('Update failed');
    });
  });

  describe('getMemoryCardsWithoutEmbeddings', () => {
    test('should find cards without embeddings', async () => {
      const mockCards = [
        { id: 'card-1', title: 'Card 1', content: 'Content 1' },
        { id: 'card-2', title: 'Card 2', content: 'Content 2' },
      ];

      mockPrisma.memoryCard.findMany.mockResolvedValueOnce(mockCards);

      const cards = await getMemoryCardsWithoutEmbeddings();

      expect(cards).toEqual(mockCards);
      expect(mockPrisma.memoryCard.findMany).toHaveBeenCalledWith({
        where: { embedding: null },
        take: 100,
        orderBy: { createdAt: 'asc' },
      });
    });

    test('should respect custom limit', async () => {
      mockPrisma.memoryCard.findMany.mockResolvedValueOnce([]);

      await getMemoryCardsWithoutEmbeddings(50);

      expect(mockPrisma.memoryCard.findMany).toHaveBeenCalledWith({
        where: { embedding: null },
        take: 50,
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('batchUpdateEmbeddings', () => {
    test('should batch update multiple embeddings', async () => {
      const updates = [
        { id: 'card-1', embedding: testEmbedding },
        { id: 'card-2', embedding: testEmbedding },
        { id: 'card-3', embedding: testEmbedding },
      ];

      mockPrisma.$transaction.mockResolvedValueOnce([{}, {}, {}]);

      await batchUpdateEmbeddings(updates);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({}),
          expect.objectContaining({}),
          expect.objectContaining({}),
        ])
      );
    });

    test('should handle empty batch updates', async () => {
      mockPrisma.$transaction.mockResolvedValueOnce([]);

      await batchUpdateEmbeddings([]);

      expect(mockPrisma.$transaction).toHaveBeenCalledWith([]);
    });

    test('should handle batch update errors', async () => {
      const updates = [{ id: 'card-1', embedding: testEmbedding }];
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('Transaction failed'));

      await expect(batchUpdateEmbeddings(updates)).rejects.toThrow('Transaction failed');
    });
  });

  describe('Integration Tests', () => {
    test('should handle full search workflow', async () => {
      // Mock search results
      const mockResults = [
        {
          id: 'card-1',
          userId: testUserId,
          title: 'Relevant Card',
          content: 'Very relevant content',
          summary: 'Summary',
          similarity: 0.95,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'card-2',
          userId: testUserId,
          title: 'Less Relevant Card',
          content: 'Somewhat relevant content',
          summary: 'Summary',
          similarity: 0.75,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce(mockResults);

      const results = await searchSimilarMemoryCards(testEmbedding, {
        userId: testUserId,
        limit: 10,
        threshold: 0.7,
      });

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
      expect(results.every(r => r.userId === testUserId)).toBe(true);
    });

    test('should format vectors consistently across operations', async () => {
      // Test vector formatting consistency
      const testVector = [1.5, -2.3, 0.0, 4.7];
      
      mockPrisma.memoryCard.create.mockResolvedValueOnce({ id: 'test-id' });
      mockPrisma.$executeRawUnsafe.mockResolvedValueOnce({});

      await createMemoryCard({
        userId: testUserId,
        title: 'Test',
        content: 'Test',
        embedding: testVector,
      });

      // Check that the vector was formatted correctly for PostgreSQL
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.any(String),
        '[1.5,-2.3,0,4.7]',
        'test-id'
      );
    });
  });
}); 