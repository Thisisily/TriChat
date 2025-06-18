import { prisma } from './src/lib/database';
import { generateEmbedding } from './src/lib/embeddings';

async function testMemorySearch() {
  console.log('Testing memory search...');
  
  try {
    // Generate embedding for the query
    const query = "What's my name?";
    console.log(`Query: "${query}"`);
    
    const embedding = await generateEmbedding(query);
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Format embedding for PostgreSQL
    const vectorString = `[${embedding.join(',')}]`;
    
    // Test with different thresholds
    const thresholds = [0.9, 0.8, 0.75, 0.7, 0.6, 0.5, 0.4, 0.3];
    
    for (const threshold of thresholds) {
      console.log(`\nTesting with threshold: ${threshold}`);
      
      const results = await prisma.$queryRaw`
        SELECT 
          "id",
          "userId",
          "title", 
          "content",
          "summary",
          "createdAt",
          "updatedAt",
          1 - ("embedding" <=> ${vectorString}::vector) as similarity
        FROM "memory_cards"
        WHERE "userId" = 'user_2yNYVvkTSFqxoQj9bfbaZLXb2Qu'
        AND "embedding" IS NOT NULL
        AND 1 - ("embedding" <=> ${vectorString}::vector) >= ${threshold}
        ORDER BY "embedding" <=> ${vectorString}::vector
        LIMIT 5
      `;
      
      console.log(`Found ${(results as any[]).length} results:`);
      (results as any[]).forEach(result => {
        console.log(`- "${result.title}" (similarity: ${result.similarity.toFixed(4)})`);
        console.log(`  Content preview: ${result.content.substring(0, 60)}...`);
      });
    }
    
    // Also show all similarities regardless of threshold
    console.log('\nAll memory cards with similarities:');
    const allResults = await prisma.$queryRaw`
      SELECT 
        "id",
        "title", 
        "content",
        1 - ("embedding" <=> ${vectorString}::vector) as similarity
      FROM "memory_cards"
      WHERE "userId" = 'user_2yNYVvkTSFqxoQj9bfbaZLXb2Qu'
      AND "embedding" IS NOT NULL
      ORDER BY similarity DESC
    `;
    
    (allResults as any[]).forEach(result => {
      console.log(`- "${result.title}" (similarity: ${result.similarity.toFixed(4)})`);
    });
    
  } catch (error) {
    console.error('Error testing memory search:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMemorySearch(); 