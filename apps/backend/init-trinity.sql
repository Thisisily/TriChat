-- Create trinity_responses table if it doesn't exist
CREATE TABLE IF NOT EXISTS trinity_responses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on message_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_trinity_responses_message_id ON trinity_responses(message_id); 