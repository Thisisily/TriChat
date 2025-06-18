import { PrismaClient } from '../../generated/prisma/index.js';

// Global Prisma client instance with connection pooling
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;

// Get the shared Prisma instance
export const db = prisma;

// Ensure trinity_responses table exists
export async function ensureTrinityTable() {
  try {
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS trinity_responses (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        message_id TEXT UNIQUE NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_trinity_responses_message_id ON trinity_responses(message_id)
    `;
    
    console.log('Trinity responses table ensured');
  } catch (error) {
    console.error('Error ensuring trinity table:', error);
  }
}

// Call this on startup
ensureTrinityTable().catch(console.error); 