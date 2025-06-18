import { prisma } from './src/lib/database';

async function checkSimilarities() {
  console.log('Checking similarities between memory cards...');
  
  try {
    // Get memory cards with embeddings
    const cardsWithEmbeddings = await prisma.$queryRaw`
      SELECT 
        m1.id as id1,
        m1.title as title1,
        m2.id as id2,
        m2.title as title2,
        1 - (m1.embedding <=> m2.embedding) as similarity
      FROM "memory_cards" m1, "memory_cards" m2
      WHERE m1.id < m2.id
      AND m1."embedding" IS NOT NULL
      AND m2."embedding" IS NOT NULL
      ORDER BY similarity DESC
    `;
    
    console.log('\nSimilarities between memory cards:');
    (cardsWithEmbeddings as any[]).forEach(result => {
      console.log(`"${result.title1}" <-> "${result.title2}": ${result.similarity.toFixed(4)}`);
    });
    
    // Check the "my name" card specifically
    console.log('\nChecking "my name" card embedding status:');
    const myNameCard = await prisma.$queryRaw`
      SELECT 
        id,
        title,
        content,
        CASE WHEN embedding IS NULL THEN 'No embedding' ELSE 'Has embedding' END as embedding_status,
        octet_length(embedding::text) as embedding_size
      FROM "memory_cards"
      WHERE title = 'my name'
    `;
    
    (myNameCard as any[]).forEach(card => {
      console.log(`- ${card.title}: ${card.embedding_status} (size: ${card.embedding_size || 0} bytes)`);
      console.log(`  Content: ${card.content}`);
    });
    
  } catch (error) {
    console.error('Error checking similarities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSimilarities(); 