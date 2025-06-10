import { z } from 'zod';

// User types
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

// Message types
export const MessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  userId: z.string(),
  content: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  model: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Message = z.infer<typeof MessageSchema>;

// Thread types
export const ThreadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  isPublic: z.boolean().default(false),
  parentThreadId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Thread = z.infer<typeof ThreadSchema>;

// LLM Provider types
export const LLMProviderSchema = z.enum(['openai', 'anthropic', 'google', 'mistral', 'openrouter']);

export type LLMProvider = z.infer<typeof LLMProviderSchema>;

// Chat completion request
export const ChatCompletionRequestSchema = z.object({
  messages: z.array(MessageSchema),
  model: z.string(),
  provider: LLMProviderSchema,
  stream: z.boolean().default(true),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().optional(),
});

export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

// API Response types
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};
