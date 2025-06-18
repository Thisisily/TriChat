-- Add lastSyncedAt field to users table for thread synchronization tracking
ALTER TABLE "users" ADD COLUMN "lastSyncedAt" TIMESTAMP(3); 