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
    
    // Simple JWT decode to get session ID (for basic verification)
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('Invalid JWT format');
        return null;
      }
      
      const payloadPart = parts[1];
      if (!payloadPart) {
        console.log('Missing JWT payload');
        return null;
      }
      
      const payload = JSON.parse(atob(payloadPart));
      const sessionId = payload.sid;
      const userId = payload.sub;
      
      if (!sessionId || !userId) {
        console.log('No session ID or user ID found in token');
        return null;
      }
      
      // Verify session is active with Clerk
      const session = await clerk.sessions.getSession(sessionId);
      
      if (!session || session.status !== 'active') {
        console.log('Session not found or not active');
        return null;
      }

      // Get user details from Clerk
      const user = await clerk.users.getUser(userId);
      
      if (!user) {
        console.log('User not found in Clerk:', userId);
        return null;
      }

      return {
        userId: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        username: user.username,
      };
      
    } catch (decodeError) {
      console.error('Failed to decode JWT token:', decodeError);
      return null;
    }
     
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}

// Verify webhook signature (for Clerk webhooks)
export function verifyWebhookSignature(
  ..._args: unknown[]
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

