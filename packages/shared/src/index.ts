// Export all types
export * from './types/index.js';

// Export utilities
export const createApiResponse = <T>(
  success: boolean,
  data?: T,
  error?: string
): {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
} => {
  const response: {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: string;
  } = {
    success,
    timestamp: new Date().toISOString(),
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (error !== undefined) {
    response.error = error;
  }

  return response;
};

// Export constants
export const SUPPORTED_LLM_MODELS = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  mistral: ['mistral-large-latest', 'mistral-small-latest'],
  openrouter: ['meta-llama/llama-3.1-405b-instruct', 'anthropic/claude-3.5-sonnet'],
} as const;
