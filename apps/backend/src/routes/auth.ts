import { z } from 'zod';
import { router, publicProcedure, authenticatedProcedure } from '../trpc/init.js';
import { syncUserToDatabase, getUserFromAuth } from '../lib/auth.js';
import * as crypto from 'crypto';

// Encryption for API keys
const getEncryptionKey = () => {
  const envKey = process.env['ENCRYPTION_KEY'];
  if (envKey) {
    return Buffer.from(envKey, 'hex');
  }
  // Generate a random key if not provided (for dev only)
  return Buffer.from(crypto.randomBytes(32).toString('hex'), 'hex');
};

const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  const parts = text.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }
  const [ivHex, encryptedHex] = parts;
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export const authRouter = router({
  // Get current user profile
  me: authenticatedProcedure
    .query(async ({ ctx }) => {
      const { user, prisma } = ctx;
      
      if (!user) {
        return { user: null };
      }
      
      // Sync user to database if not exists
      try {
        await prisma.user.upsert({
          where: { id: user.userId },
          update: {
            email: user.email,
            username: user.username,
            updatedAt: new Date(),
          },
          create: {
            id: user.userId,
            email: user.email,
            username: user.username,
          },
        });
      } catch (error) {
        console.error('Failed to sync user to database:', error);
      }
      
      return { user };
    }),

  // Update user profile
  updateProfile: authenticatedProcedure
    .input(z.object({
      username: z.string().min(1).max(50).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;

      // Build update object conditionally to avoid TypeScript strict issues
      const updateData: { username?: string; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      
      if (input.username !== undefined) {
        updateData.username = input.username;
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.userId },
        data: updateData,
      });

      return { user: updatedUser };
    }),

  // Get user's API keys
  getApiKeys: authenticatedProcedure
    .query(async ({ ctx }) => {
      const { user, prisma } = ctx;
      
      const apiKeys = await prisma.userApiKey.findMany({
        where: { userId: user.userId },
        select: {
          id: true,
          provider: true,
          keyName: true,
          createdAt: true,
        },
      });
      
      return { apiKeys };
    }),

  // Add API key
  addApiKey: authenticatedProcedure
    .input(z.object({
      provider: z.string(),
      keyName: z.string(),
      apiKey: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;
      
      // Encrypt the API key
      const encrypted = encrypt(input.apiKey);
      
      const apiKey = await prisma.userApiKey.create({
        data: {
          userId: user.userId,
          provider: input.provider,
          keyName: input.keyName,
          encrypted,
        },
        select: {
          id: true,
          provider: true,
          keyName: true,
          createdAt: true,
        },
      });
      
      return { apiKey };
    }),

  // Delete API key
  deleteApiKey: authenticatedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, prisma } = ctx;
      
      // Verify ownership
      const existing = await prisma.userApiKey.findFirst({
        where: {
          id: input.id,
          userId: user.userId,
        },
      });
      
      if (!existing) {
        throw new Error('API key not found');
      }
      
      await prisma.userApiKey.delete({
        where: { id: input.id },
      });
      
      return { success: true };
    }),

  // Test API key decryption (internal use)
  getDecryptedApiKey: authenticatedProcedure
    .input(z.object({
      provider: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const { user, prisma } = ctx;
      
      const apiKey = await prisma.userApiKey.findFirst({
        where: {
          userId: user.userId,
          provider: input.provider,
        },
      });
      
      if (!apiKey) {
        return { apiKey: null };
      }
      
      const decrypted = decrypt(apiKey.encrypted);
      return { apiKey: decrypted };
    }),

  // Clerk webhook handler for user sync
  webhook: publicProcedure
    .input(z.object({
      type: z.string(),
      data: z.any(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Note: In a real app, you'd verify the webhook signature here
      // For now, we'll just handle the basic user events
      
      try {
        switch (input.type) {
          case 'user.created':
          case 'user.updated':
            await syncUserToDatabase(input.data);
            break;
          
          case 'user.deleted':
            if (input.data?.id) {
              await ctx.prisma.user.delete({
                where: { id: input.data.id },
              });
            }
            break;
            
          default:
            console.log(`Unhandled webhook type: ${input.type}`);
        }

        return { success: true };
      } catch (error) {
        console.error('Webhook processing error:', error);
        throw new Error('Failed to process webhook');
      }
    }),

  // Sign out (clear local session - Clerk handles this on frontend)
  signOut: authenticatedProcedure
    .mutation(async () => {
      // In a traditional app, you might invalidate tokens here
      // With Clerk, sign-out is primarily handled on the frontend
      return { success: true };
    }),
}); 