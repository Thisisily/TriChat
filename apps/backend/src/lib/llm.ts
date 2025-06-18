import { z } from 'zod';
import * as crypto from 'crypto';

// Decryption helper (should match the one in auth.ts)
const getEncryptionKey = () => {
  const envKey = process.env['ENCRYPTION_KEY'];
  if (envKey) {
    return Buffer.from(envKey, 'hex');
  }
  // Generate a random key if not provided (for dev only)
  return Buffer.from(crypto.randomBytes(32).toString('hex'), 'hex');
};

const ENCRYPTION_KEY = getEncryptionKey();

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

// LLM Provider types  
export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'openrouter';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

export interface LLMStreamChunk {
  content: string;
  delta: string;
  isComplete: boolean;
  usage?: LLMResponse['usage'];
  finishReason?: LLMResponse['finishReason'];
}

// LLM Configuration schema
export const LLMConfigSchema = z.object({
  model: z.string(),
  provider: z.enum(['openai', 'anthropic', 'google', 'mistral', 'openrouter']),
  apiKey: z.string(),
  maxTokens: z.number().default(2048),
  temperature: z.number().min(0).max(2).default(0.7),
  stream: z.boolean().default(true),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

// Base LLM Service interface
export interface LLMService {
  generateResponse(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse>;
  
  generateStreamResponse(
    messages: LLMMessage[],
    config: LLMConfig
  ): AsyncGenerator<LLMStreamChunk, void, unknown>;
}

// OpenAI Service Implementation
class OpenAIService implements LLMService {
  async generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    console.log(`\n--- Calling OpenAI (${config.model}) ---`);
    console.log('Messages:', JSON.stringify(messages.slice(0, 2), null, 2)); // Log first 2 messages for brevity
    console.log('Config:', { model: config.model, temp: config.temperature, max_tokens: config.maxTokens });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: false,
      }),
    });

    console.log(`OpenAI Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI Response Data:', JSON.stringify(data.choices?.[0], null, 2));
    
    return {
      content: data.choices[0]?.message?.content || '',
      model: config.model,
      provider: 'openai',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: data.choices[0]?.finish_reason || 'stop',
    };
  }

  async* generateStreamResponse(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<LLMStreamChunk> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from OpenAI API');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield {
                content,
                delta: '',
                isComplete: true,
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta?.content || '';
              content += delta;

              yield {
                content,
                delta,
                isComplete: false,
                usage: parsed.usage ? {
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                  totalTokens: parsed.usage.total_tokens || 0,
                } : undefined,
                finishReason: parsed.choices[0]?.finish_reason,
              };
            } catch (error) {
              console.warn('Failed to parse OpenAI streaming chunk:', error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// OpenRouter Service Implementation for Multi-LLM Access
class OpenRouterService implements LLMService {
  async generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trichat.app', // Optional: for OpenRouter analytics
        'X-Title': 'TriChat', // Optional: for OpenRouter analytics
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0]?.message?.content || '',
      model: config.model,
      provider: 'openrouter',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: data.choices[0]?.finish_reason || 'stop',
    };
  }

  async* generateStreamResponse(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<LLMStreamChunk> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trichat.app',
        'X-Title': 'TriChat',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from OpenRouter API');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield {
                content,
                delta: '',
                isComplete: true,
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta?.content || '';
              content += delta;

              yield {
                content,
                delta,
                isComplete: false,
                usage: parsed.usage ? {
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                  totalTokens: parsed.usage.total_tokens || 0,
                } : undefined,
                finishReason: parsed.choices[0]?.finish_reason,
              };
            } catch (error) {
              console.warn('Failed to parse OpenRouter streaming chunk:', error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Anthropic Service Implementation
class AnthropicService implements LLMService {
  async generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    // Convert messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

    console.log(`\n--- Calling Anthropic (${config.model}) ---`);
    console.log('Messages:', JSON.stringify(anthropicMessages.slice(0, 2), null, 2));
    console.log('Config:', { model: config.model, temp: config.temperature, max_tokens: config.maxTokens });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        messages: anthropicMessages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemMessage,
      }),
    });

    console.log(`Anthropic Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API Error:', errorText);
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Anthropic Response Data:', JSON.stringify(data.content?.[0], null, 2));
    
    return {
      content: data.content[0]?.text || '',
      model: config.model,
      provider: 'anthropic',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason,
    };
  }

  async* generateStreamResponse(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<LLMStreamChunk> {
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        messages: anthropicMessages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemMessage,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API Error:', errorText);
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body from Anthropic API');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta') {
                const delta = parsed.delta?.text || '';
                content += delta;

                yield {
                  content,
                  delta,
                  isComplete: false,
                };
              } else if (parsed.type === 'message_stop') {
                yield {
                  content,
                  delta: '',
                  isComplete: true,
                  usage: parsed.usage ? {
                    promptTokens: parsed.usage.input_tokens || 0,
                    completionTokens: parsed.usage.output_tokens || 0,
                    totalTokens: (parsed.usage.input_tokens || 0) + (parsed.usage.output_tokens || 0),
                  } : undefined,
                };
              }
            } catch (error) {
              console.warn('Failed to parse Anthropic streaming chunk:', error);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Google Gemini Service Implementation
class GoogleService implements LLMService {
  async generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    // Convert messages to Gemini format
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Handle system message by prepending to first user message
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage && contents.length > 0 && contents[0] && contents[0].parts && contents[0].parts[0]) {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

    console.log(`\n--- Calling Google (${config.model}) ---`);
    console.log('Messages:', JSON.stringify(contents.slice(0, 2), null, 2));
    console.log('Config:', { model: config.model, temp: config.temperature, max_tokens: config.maxTokens });

    const modelName = config.model.includes('gemini') ? config.model : `gemini-${config.model}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens,
          },
        }),
      }
    );

    console.log(`Google Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google API Error:', errorText);
      throw new Error(`Google API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Google Response Data:', JSON.stringify(data.candidates?.[0], null, 2));
    
    return {
      content: data.candidates[0]?.content?.parts[0]?.text || '',
      model: config.model,
      provider: 'google',
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      finishReason: data.candidates[0]?.finishReason === 'STOP' ? 'stop' : data.candidates[0]?.finishReason,
    };
  }

  async* generateStreamResponse(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<LLMStreamChunk> {
    // Google doesn't support streaming via REST API yet
    // Fallback to non-streaming response
    const response = await this.generateResponse(messages, config);
    
    // Simulate streaming by yielding words
    const words = response.content.split(' ');
    let content = '';
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const delta = (i > 0 ? ' ' : '') + word;
      content += delta;
      
      yield {
        content,
        delta,
        isComplete: i === words.length - 1,
        usage: i === words.length - 1 ? response.usage : undefined,
        finishReason: i === words.length - 1 ? response.finishReason : undefined,
      };
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
}

// Mock Service for testing and unsupported providers
class MockLLMService implements LLMService {
  async generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const lastMessage = messages[messages.length - 1]?.content || '';
    const response = `Mock response to: "${lastMessage}" using ${config.model}`;
    
    return {
      content: response,
      model: config.model,
      provider: config.provider,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      finishReason: 'stop',
    };
  }

  async* generateStreamResponse(messages: LLMMessage[], config: LLMConfig): AsyncGenerator<LLMStreamChunk> {
    const lastMessage = messages[messages.length - 1]?.content || '';
    const words = `Mock streaming response to "${lastMessage}" using ${config.model}`.split(' ');
    
    let content = '';
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const delta = (i > 0 ? ' ' : '') + word;
      content += delta;
      
      yield {
        content,
        delta,
        isComplete: i === words.length - 1,
        usage: i === words.length - 1 ? {
          promptTokens: 10,
          completionTokens: words.length,
          totalTokens: 10 + words.length,
        } : undefined,
      };
      
      // Simulate streaming delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Service Factory
export class LLMServiceFactory {
  private static services: Map<LLMProvider, LLMService> = new Map([
    ['openai', new OpenAIService()],
    ['anthropic', new AnthropicService()],
    ['google', new GoogleService()],
    ['mistral', new MockLLMService()], // TODO: Implement Mistral
    ['openrouter', new OpenRouterService()],
  ]);

  static getService(provider: LLMProvider): LLMService {
    const service = this.services.get(provider);
    if (!service) {
      throw new Error(`LLM service not implemented for provider: ${provider}`);
    }
    return service;
  }

  static getMockService(): LLMService {
    return new MockLLMService();
  }
}

// Main LLM function for easy usage
export async function generateLLMResponse(
  messages: LLMMessage[],
  config: LLMConfig
): Promise<LLMResponse> {
  const service = LLMServiceFactory.getService(config.provider);
  return service.generateResponse(messages, config);
}

export async function* generateLLMStreamResponse(
  messages: LLMMessage[],
  config: LLMConfig
): AsyncGenerator<LLMStreamChunk> {
  const service = LLMServiceFactory.getService(config.provider);
  yield* service.generateStreamResponse(messages, config);
}

// Helper function to get user's API key for a provider
export async function getUserApiKey(
  userId: string,
  provider: LLMProvider,
  prisma: any
): Promise<string | null> {
  console.log(`Getting API key for user ${userId}, provider ${provider}`);
  
  const apiKey = await prisma.userApiKey.findFirst({
    where: {
      userId,
      provider,
    },
    select: {
      encrypted: true,
    },
  });

  if (!apiKey) {
    console.log(`No API key found for user ${userId}, provider ${provider}`);
    return null;
  }

  // Decrypt the API key
  try {
    const decrypted = decrypt(apiKey.encrypted);
    console.log(`Successfully decrypted API key for provider ${provider}, length: ${decrypted.length}`);
    console.log(`First 10 chars of decrypted key: ${decrypted.substring(0, 10)}...`);
    
    // Check if the key looks valid
    if (provider === 'openai' && !decrypted.startsWith('sk-')) {
      console.warn(`Warning: OpenAI key doesn't start with 'sk-'`);
    }
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return null;
  }
}

// Helper to validate model for provider
export function validateModelForProvider(provider: LLMProvider, model: string): boolean {
  const providerModels: Record<LLMProvider, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
    openrouter: [
      // OpenAI models via OpenRouter
      'openai/gpt-4o',
      'openai/gpt-4o-mini', 
      'openai/gpt-4-turbo',
      'openai/gpt-3.5-turbo',
      // Anthropic models via OpenRouter
      'anthropic/claude-3-5-sonnet',
      'anthropic/claude-3-5-haiku',
      'anthropic/claude-3-opus',
      // Google models via OpenRouter
      'google/gemini-pro-1.5',
      'google/gemini-flash-1.5',
      // Other providers via OpenRouter
      'meta-llama/llama-3-70b-instruct',
      'meta-llama/llama-3-8b-instruct',
      'mistralai/mistral-7b-instruct',
      'mistralai/mixtral-8x7b-instruct',
      'microsoft/wizardlm-2-8x22b',
      'cohere/command-r-plus',
      'perplexity/llama-3-sonar-large-32k-online',
      // Specialized models
      'openai/o1-preview',
      'openai/o1-mini',
      'qwen/qwen-2-72b-instruct',
    ],
  };

  return providerModels[provider]?.includes(model) || false;
}
