import { z } from 'zod';
import type { LLMMessage } from './llm.js';

// Trinity Mode Execution Modes
export type TrinityExecutionMode = 'parallel' | 'sequential' | 'hybrid';

// Agent Types and Specializations
export type AgentType = 'analytical' | 'creative' | 'factual';

export interface AgentConfig {
  type: AgentType;
  model: string;
  provider: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  weight: number; // Influence weight in final response (0-1)
  enabled: boolean;
}

export interface TrinityConfig {
  executionMode: TrinityExecutionMode;
  agents: {
    analytical: AgentConfig;
    creative: AgentConfig;
    factual: AgentConfig;
  };
  orchestrator: {
    model: string;
    provider: string;
    temperature: number;
    maxTokens: number;
    blendingStrategy: BlendingStrategy;
  };
  timeout: number; // Max time to wait for all agents in parallel mode
  fallbackToSingleAgent: boolean; // Fallback if agents fail
}

// Blending Strategies for Orchestrator
export type BlendingStrategy = 
  | 'weighted_merge' // Combine based on agent weights
  | 'best_of_three' // Select best response
  | 'synthesis' // Create new response incorporating all three
  | 'hierarchical' // Structure response with sections from each agent;

// Agent Response with Metadata
export interface AgentResponse {
  agentType: AgentType;
  content: string;
  confidence: number; // Agent's confidence in response (0-1)
  executionTime: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    model: string;
    provider: string;
    temperature: number;
    finishReason?: string;
  };
}

// Trinity Response with All Agent Outputs
export interface TrinityResponse {
  finalResponse: string;
  agentResponses: AgentResponse[];
  orchestratorMetadata: {
    blendingStrategy: BlendingStrategy;
    executionMode: TrinityExecutionMode;
    totalExecutionTime: number;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  attribution: {
    [key in AgentType]?: {
      contributionPercentage: number;
      keyInsights: string[];
    };
  };
}

// Streaming Trinity Response for Real-time Updates
export interface TrinityStreamChunk {
  type: 'agent_start' | 'agent_chunk' | 'agent_complete' | 'orchestrator_chunk' | 'trinity_complete';
  agentType?: AgentType;
  content: string;
  delta: string;
  isComplete: boolean;
  timestamp: number;
  metadata?: {
    confidence?: number;
    executionTime?: number;
    tokenUsage?: AgentResponse['tokenUsage'];
  };
}

// Agent Interface
export interface Agent {
  readonly type: AgentType;
  readonly config: AgentConfig;
  
  generateResponse(
    messages: LLMMessage[],
    context?: any
  ): Promise<AgentResponse>;
  
  generateStreamResponse(
    messages: LLMMessage[],
    context?: any
  ): AsyncGenerator<TrinityStreamChunk, void, unknown>;
  
  updateConfig(config: Partial<AgentConfig>): void;
  validateResponse(response: string): boolean;
}

// Orchestrator Interface
export interface Orchestrator {
  blendResponses(
    responses: AgentResponse[],
    strategy: BlendingStrategy,
    originalMessages: LLMMessage[],
    apiKey?: string
  ): Promise<string>;
  
  generateAttribution(
    responses: AgentResponse[],
    finalResponse: string
  ): TrinityResponse['attribution'];
  
  resolveConflicts(
    responses: AgentResponse[]
  ): AgentResponse[];
  
  selectBestResponse(
    responses: AgentResponse[]
  ): AgentResponse;
}

// Trinity Mode Manager Interface
export interface TrinityManager {
  executeParallel(
    messages: LLMMessage[],
    config: TrinityConfig,
    apiKeys?: { analytical: string | null; creative: string | null; factual: string | null }
  ): Promise<TrinityResponse>;
  
  executeSequential(
    messages: LLMMessage[],
    config: TrinityConfig,
    apiKeys?: { analytical: string | null; creative: string | null; factual: string | null }
  ): Promise<TrinityResponse>;
  
  executeHybrid(
    messages: LLMMessage[],
    config: TrinityConfig,
    apiKeys?: { analytical: string | null; creative: string | null; factual: string | null }
  ): Promise<TrinityResponse>;
  
  streamTrinityResponse(
    messages: LLMMessage[],
    config: TrinityConfig,
    apiKeys?: { analytical: string | null; creative: string | null; factual: string | null }
  ): AsyncGenerator<TrinityStreamChunk, void, unknown>;
  
  getDefaultConfig(): TrinityConfig;
  validateConfig(config: TrinityConfig): boolean;
}

// Validation Schemas
export const AgentConfigSchema = z.object({
  type: z.enum(['analytical', 'creative', 'factual']),
  model: z.string(),
  provider: z.string(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().min(1).max(4096),
  systemPrompt: z.string(),
  weight: z.number().min(0).max(1),
  enabled: z.boolean(),
});

export const TrinityConfigSchema = z.object({
  executionMode: z.enum(['parallel', 'sequential', 'hybrid']),
  agents: z.object({
    analytical: AgentConfigSchema,
    creative: AgentConfigSchema,
    factual: AgentConfigSchema,
  }),
  orchestrator: z.object({
    model: z.string(),
    provider: z.string(),
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().min(1).max(8192),
    blendingStrategy: z.enum(['weighted_merge', 'best_of_three', 'synthesis', 'hierarchical']),
  }),
  timeout: z.number().min(1000).max(300000), // 1s to 5min
  fallbackToSingleAgent: z.boolean(),
});

// Default Configurations
export const DEFAULT_AGENT_CONFIGS: Record<AgentType, Omit<AgentConfig, 'type'>> = {
  analytical: {
    model: 'gpt-4o',
    provider: 'openai',
    temperature: 0.1,
    maxTokens: 2048,
    systemPrompt: `You are an analytical agent focused on logical reasoning, data analysis, and systematic problem-solving. 
    Your role is to:
    - Break down complex problems into components
    - Provide structured, logical analysis
    - Identify patterns and relationships
    - Offer evidence-based conclusions
    - Highlight assumptions and potential biases
    
    Always prioritize accuracy and logical consistency in your responses.`,
    weight: 0.4,
    enabled: true,
  },
  creative: {
    model: 'gpt-4o',
    provider: 'openai',
    temperature: 0.8,
    maxTokens: 2048,
    systemPrompt: `You are a creative agent focused on innovative thinking, alternative perspectives, and imaginative solutions.
    Your role is to:
    - Generate novel ideas and creative approaches
    - Explore unconventional solutions
    - Provide metaphors and analogies
    - Think outside conventional frameworks
    - Encourage exploration of possibilities
    
    Embrace creativity while maintaining relevance to the user's needs.`,
    weight: 0.3,
    enabled: true,
  },
  factual: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    temperature: 0.0,
    maxTokens: 2048,
    systemPrompt: `You are a factual agent focused on accuracy, verification, and reliable information.
    Your role is to:
    - Provide accurate, verifiable information
    - Cite sources when possible
    - Flag uncertain or controversial claims
    - Prioritize factual correctness
    - Identify misinformation or inaccuracies
    
    Always strive for truth and accuracy in your responses.`,
    weight: 0.3,
    enabled: true,
  },
};

export const DEFAULT_TRINITY_CONFIG: TrinityConfig = {
  executionMode: 'parallel',
  agents: {
    analytical: { type: 'analytical', ...DEFAULT_AGENT_CONFIGS.analytical },
    creative: { type: 'creative', ...DEFAULT_AGENT_CONFIGS.creative },
    factual: { type: 'factual', ...DEFAULT_AGENT_CONFIGS.factual },
  },
  orchestrator: {
    model: 'gpt-4o',
    provider: 'openai',
    temperature: 0.3,
    maxTokens: 4096,
    blendingStrategy: 'synthesis',
  },
  timeout: 60000, // 60 seconds
  fallbackToSingleAgent: true,
};

// Preset Configurations for Common Use Cases
export const TRINITY_PRESETS: Record<string, Partial<TrinityConfig>> = {
  'creative-writing': {
    agents: {
      creative: { type: 'creative', ...DEFAULT_AGENT_CONFIGS.creative, weight: 0.6, temperature: 0.9 },
      analytical: { type: 'analytical', ...DEFAULT_AGENT_CONFIGS.analytical, weight: 0.2 },
      factual: { type: 'factual', ...DEFAULT_AGENT_CONFIGS.factual, weight: 0.2 },
    },
    orchestrator: {
      ...DEFAULT_TRINITY_CONFIG.orchestrator,
      blendingStrategy: 'weighted_merge',
      temperature: 0.7,
    },
  },
  'research-analysis': {
    agents: {
      factual: { type: 'factual', ...DEFAULT_AGENT_CONFIGS.factual, weight: 0.5 },
      analytical: { type: 'analytical', ...DEFAULT_AGENT_CONFIGS.analytical, weight: 0.4 },
      creative: { type: 'creative', ...DEFAULT_AGENT_CONFIGS.creative, weight: 0.1, enabled: false },
    },
    orchestrator: {
      ...DEFAULT_TRINITY_CONFIG.orchestrator,
      blendingStrategy: 'hierarchical',
      temperature: 0.1,
    },
  },
  'problem-solving': {
    executionMode: 'sequential' as TrinityExecutionMode,
    agents: {
      analytical: { type: 'analytical', ...DEFAULT_AGENT_CONFIGS.analytical, weight: 0.4 },
      creative: { type: 'creative', ...DEFAULT_AGENT_CONFIGS.creative, weight: 0.35 },
      factual: { type: 'factual', ...DEFAULT_AGENT_CONFIGS.factual, weight: 0.25 },
    },
    orchestrator: {
      ...DEFAULT_TRINITY_CONFIG.orchestrator,
      blendingStrategy: 'synthesis',
    },
  },
  'brainstorming': {
    agents: {
      creative: { type: 'creative', ...DEFAULT_AGENT_CONFIGS.creative, weight: 0.7, temperature: 1.0 },
      analytical: { type: 'analytical', ...DEFAULT_AGENT_CONFIGS.analytical, weight: 0.2 },
      factual: { type: 'factual', ...DEFAULT_AGENT_CONFIGS.factual, weight: 0.1 },
    },
    orchestrator: {
      ...DEFAULT_TRINITY_CONFIG.orchestrator,
      blendingStrategy: 'best_of_three',
      temperature: 0.8,
    },
  },
}; 