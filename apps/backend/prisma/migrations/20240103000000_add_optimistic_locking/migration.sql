-- Add version columns for optimistic locking and conflict resolution

-- Add version column to threads table
ALTER TABLE "threads" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
 
-- Add version column to messages table  
ALTER TABLE "messages" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1; 