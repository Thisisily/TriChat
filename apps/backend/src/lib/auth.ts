import { createClerkClient } from '@clerk/backend';

// Initialize Clerk client with error handling
const secretKey = process.env['CLERK_SECRET_KEY'];
if (!secretKey) {
  console.warn('CLERK_SECRET_KEY environment variable not set - authentication will not work');
}

export const clerk = secretKey ? createClerkClient({
  secretKey,
}) : null;

// Extract user ID from Authorization header
export async function getUserFromAuth(authHeader: string | undefined): Promise<{
  userId: string;
  email: string;
  username: string | null;
} | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ') || !clerk) {
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    
    // For now, we'll implement a basic token verification
    // In production, this should use proper Clerk session verification
    // TODO: Implement proper Clerk session verification once API is clarified
    
    if (token === 'test_token') {
      // Mock user for testing
      return {
        userId: 'user_test123',
        email: 'test@example.com',
        username: 'testuser',
      };
    }
    
    // Return null for any other token for now
    console.log('Token verification not yet implemented:', token.substring(0, 10) + '...');
    return null;
    
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}

// Verify webhook signature (for Clerk webhooks)
export function verifyWebhookSignature(
  _payload: string,
  _headers: Record<string, string | undefined>
): boolean {
  try {
    const webhookSecret = process.env['CLERK_WEBHOOK_SECRET'];
    if (!webhookSecret) {
      console.warn('CLERK_WEBHOOK_SECRET not set');
      return false;
    }

    // Note: In production, you'd want to implement proper webhook signature verification
    // using Clerk's webhook verification utilities
    return true;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return false;
  }
}

// Sync user data with our database
export async function syncUserToDatabase(clerkUser: any): Promise<void> {
  try {
    const { prisma } = await import('./database.js');
    
    await prisma.user.upsert({
      where: { id: clerkUser.id },
      update: {
        email: clerkUser.email_addresses[0]?.email_address || '',
        username: clerkUser.username,
        updatedAt: new Date(),
      },
      create: {
        id: clerkUser.id,
        email: clerkUser.email_addresses[0]?.email_address || '',
        username: clerkUser.username,
      },
    });
  } catch (error) {
    console.error('Failed to sync user to database:', error);
    throw error;
  }
} 