// Set environment variables before importing
process.env['OPENAI_API_KEY'] = 'test-key';
process.env['EMBEDDING_MODEL'] = 'text-embedding-3-small';
process.env['EMBEDDING_DIMENSIONS'] = '1536';
process.env['BATCH_SIZE'] = '16';

import { test, expect, describe, beforeAll, afterAll, mock } from 'bun:test';
import {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  normalizeVector,
  formatVectorForPg,
  parseVectorFromPg,
  validateEmbedding,
  getEmbeddingConfig,
  type EmbeddingResult,
  type BatchEmbeddingResult,
} from '../lib/embeddings';

// Mock OpenAI API responses
const mockOpenAI = {
  embeddings: {
    create: mock(() => Promise.resolve({
      data: [{ embedding: new Array(1536).fill(0).map(() => Math.random()) }],
      usage: { total_tokens: 10 }
    }))
  }
};

// Mock the OpenAI import
mock.module('openai', () => ({
  OpenAI: function() {
    return mockOpenAI;
  }
}));

describe('Embeddings Service', () => {
  afterAll(() => {
    // Clean up environment variables
    delete process.env['OPENAI_API_KEY'];
    delete process.env['EMBEDDING_MODEL'];
    delete process.env['EMBEDDING_DIMENSIONS'];
    delete process.env['BATCH_SIZE'];
  });

  describe('generateEmbedding', () => {
    test('should generate embedding for single text', async () => {
      const text = 'Hello, world!';
      const embedding = await generateEmbedding(text);
      
      expect(embedding).toBeInstanceOf(Array);
      expect(embedding).toHaveLength(1536);
      expect(embedding.every(num => typeof num === 'number')).toBe(true);
    });

    test('should handle empty text', async () => {
      const embedding = await generateEmbedding('');
      
      expect(embedding).toBeInstanceOf(Array);
      expect(embedding).toHaveLength(1536);
    });

    test('should handle API errors gracefully', async () => {
      // Mock API error
      mockOpenAI.embeddings.create.mockRejectedValueOnce(new Error('API Error'));
      
      await expect(generateEmbedding('test')).rejects.toThrow('Failed to generate embedding');
    });
  });

  describe('generateEmbeddingsBatch', () => {
    test('should generate embeddings for multiple texts', async () => {
      const texts = ['Hello', 'World', 'Test'];
      
      // Mock batch response
      mockOpenAI.embeddings.create.mockResolvedValueOnce({
        data: texts.map(() => ({ 
          embedding: new Array(1536).fill(0).map(() => Math.random()) 
        })),
        usage: { total_tokens: 30 }
      });

      const result: BatchEmbeddingResult = await generateEmbeddingsBatch(texts);
      
      expect(result.results).toHaveLength(3);
      expect(result.totalTokens).toBe(30);
      expect(result.model).toBe('text-embedding-3-small');
      
      result.results.forEach((item: EmbeddingResult, index: number) => {
        expect(item.text).toBe(texts[index] || '');
        expect(item.embedding).toHaveLength(1536);
        expect(item.index).toBe(index);
      });
    });

    test('should handle empty input array', async () => {
      const result = await generateEmbeddingsBatch([]);
      
      expect(result.results).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.model).toBe('text-embedding-3-small');
    });

    test('should batch large arrays correctly', async () => {
      const texts = new Array(35).fill(0).map((_, i) => `Text ${i}`);
      
      // Mock multiple batch responses
      mockOpenAI.embeddings.create
        .mockResolvedValueOnce({
          data: new Array(16).fill(0).map(() => ({ 
            embedding: new Array(1536).fill(0).map(() => Math.random()) 
          })),
          usage: { total_tokens: 160 }
        })
        .mockResolvedValueOnce({
          data: new Array(16).fill(0).map(() => ({ 
            embedding: new Array(1536).fill(0).map(() => Math.random()) 
          })),
          usage: { total_tokens: 160 }
        })
        .mockResolvedValueOnce({
          data: new Array(3).fill(0).map(() => ({ 
            embedding: new Array(1536).fill(0).map(() => Math.random()) 
          })),
          usage: { total_tokens: 30 }
        });

      const result = await generateEmbeddingsBatch(texts);
      
      expect(result.results).toHaveLength(35);
      expect(result.totalTokens).toBe(350);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('Vector Utilities', () => {
    test('cosineSimilarity should calculate correct similarity', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      const c = [0, 1, 0];
      
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
      expect(cosineSimilarity(a, c)).toBeCloseTo(0.0, 5);
    });

    test('cosineSimilarity should handle zero vectors', () => {
      const zero = [0, 0, 0];
      const nonZero = [1, 2, 3];
      
      expect(cosineSimilarity(zero, nonZero)).toBe(0);
    });

    test('cosineSimilarity should throw on mismatched lengths', () => {
      expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('Vectors must have the same length');
    });

    test('normalizeVector should create unit vector', () => {
      const vector = [3, 4, 0];
      const normalized = normalizeVector(vector);
      
      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
      expect(normalized[2]).toBeCloseTo(0.0, 5);
      
      // Check that it's unit length
      const length = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0));
      expect(length).toBeCloseTo(1.0, 5);
    });

    test('normalizeVector should handle zero vector', () => {
      const zero = [0, 0, 0];
      const normalized = normalizeVector(zero);
      
      expect(normalized).toEqual([0, 0, 0]);
    });

    test('formatVectorForPg should format correctly', () => {
      const vector = [1.5, -2.3, 0.0];
      const formatted = formatVectorForPg(vector);
      
      expect(formatted).toBe('[1.5,-2.3,0]');
    });

    test('parseVectorFromPg should parse correctly', () => {
      const vectorString = '[1.5,-2.3,0]';
      const parsed = parseVectorFromPg(vectorString);
      
      expect(parsed).toEqual([1.5, -2.3, 0]);
    });

    test('parseVectorFromPg should handle empty string', () => {
      expect(parseVectorFromPg('')).toEqual([]);
      expect(parseVectorFromPg(null as any)).toEqual([]);
    });

    test('validateEmbedding should validate correctly', () => {
      const validEmbedding = new Array(1536).fill(0.5);
      const invalidLength = new Array(512).fill(0.5);
      const invalidType = ['not', 'numbers'] as any;
      const withNaN = [1, 2, NaN, 4];
      
      expect(validateEmbedding(validEmbedding)).toBe(true);
      expect(validateEmbedding(invalidLength)).toBe(false);
      expect(validateEmbedding(invalidType)).toBe(false);
      expect(validateEmbedding(withNaN)).toBe(false);
    });
  });

  describe('Configuration', () => {
    test('getEmbeddingConfig should return correct config', () => {
      const config = getEmbeddingConfig();
      
      expect(config.model).toBe('text-embedding-3-small');
      expect(config.dimensions).toBe(1536);
      expect(config.batchSize).toBe(16);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    test('should retry on API failures', async () => {
      // Mock first two calls to fail, third to succeed
      mockOpenAI.embeddings.create
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockResolvedValueOnce({
          data: [{ embedding: new Array(1536).fill(0.5) }],
          usage: { total_tokens: 10 }
        });

      const embedding = await generateEmbedding('test');
      
      expect(embedding).toHaveLength(1536);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(3);
    });

    test('should fail after max retries', async () => {
      // Mock all calls to fail
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('Persistent error'));

      await expect(generateEmbedding('test')).rejects.toThrow('Failed to generate embedding after 3 attempts');
    });
  });

  describe('Performance', () => {
    test('batch processing should be more efficient than individual calls', async () => {
      const texts = new Array(32).fill(0).map((_, i) => `Text ${i}`);
      
      // Mock batch responses
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: new Array(16).fill(0).map(() => ({ 
          embedding: new Array(1536).fill(0).map(() => Math.random()) 
        })),
        usage: { total_tokens: 160 }
      });

      const startTime = Date.now();
      await generateEmbeddingsBatch(texts);
      const batchTime = Date.now() - startTime;
      
      // Should make only 2 API calls (32 texts / 16 batch size)
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2);
      
      // Batch processing should be efficient
      expect(batchTime).toBeLessThan(1000); // Should complete quickly in test environment
    });
  });
}); 