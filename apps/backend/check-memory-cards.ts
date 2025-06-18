import { prisma } from './src/lib/database';

async function checkMemoryCards() {
  console.log('Starting memory card check...');
  try {
    // Check total memory cards
    const totalCards = await prisma.memoryCard.count();
    console.log(`Total memory cards: ${totalCards}`);
    
    // Get all memory cards
    const cards = await prisma.memoryCard.findMany({
      select: {
        id: true,
        title: true,
        content: true,
        userId: true,
        createdAt: true
      }
    });
    
    console.log('\nMemory cards:');
    cards.forEach(card => {
      console.log(`- ${card.title} (User: ${card.userId})`);
      console.log(`  Content: ${card.content.substring(0, 100)}...`);
      console.log(`  Created: ${card.createdAt}`);
      console.log('');
    });
    
    // Check if any have embeddings
    const cardsWithEmbeddings = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM "memory_cards" 
      WHERE "embedding" IS NOT NULL
    `;
    console.log(`Cards with embeddings: ${(cardsWithEmbeddings as any)[0].count}`);
    
  } catch (error) {
    console.error('Error checking memory cards:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMemoryCards(); 