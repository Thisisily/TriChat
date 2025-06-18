import type { 
  Agent, 
  AgentType, 
  AgentConfig, 
  AgentResponse, 
  TrinityStreamChunk 
} from './trinity-mode.js';
import type { LLMMessage } from './llm.js';
import { 
  generateLLMResponse, 
  generateLLMStreamResponse
} from './llm.js';

// Base Agent Implementation
export class BaseAgent implements Agent {
  public readonly type: AgentType;
  public config: AgentConfig;

  constructor(config: AgentConfig) {
    this.type = config.type;
    this.config = config;
  }

  async generateResponse(
    messages: LLMMessage[],
    context?: any
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // Prepare messages with agent-specific system prompt
      const agentMessages: LLMMessage[] = [
        { role: 'system', content: this.config.systemPrompt },
        ...messages,
      ];

      // Get API key from context or use empty string
      const apiKey = context?.apiKey || '';
      
      console.log(`Agent ${this.type} API key status:`, {
        hasContext: !!context,
        hasApiKey: !!context?.apiKey,
        apiKeyLength: apiKey.length,
        apiKeyPrefix: apiKey.substring(0, 20) + '...'
      });

      // Generate response using the LLM service
      const llmResponse = await generateLLMResponse(agentMessages, {
        model: this.config.model,
        provider: this.config.provider as any,
        apiKey,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        stream: false,
      });

      const executionTime = Date.now() - startTime;
      
      // Calculate confidence based on response characteristics
      const confidence = this.calculateConfidence(llmResponse.content, llmResponse.finishReason);

      const metadata: { model: string; provider: string; temperature: number; finishReason?: string } = {
        model: this.config.model,
        provider: this.config.provider,
        temperature: this.config.temperature,
      };
      
      if (llmResponse.finishReason) {
        metadata.finishReason = llmResponse.finishReason;
      }

      return {
        agentType: this.type,
        content: llmResponse.content,
        confidence,
        executionTime,
        tokenUsage: llmResponse.usage || {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        metadata,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        agentType: this.type,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        executionTime,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        metadata: {
          model: this.config.model,
          provider: this.config.provider,
          temperature: this.config.temperature,
          finishReason: 'error',
        },
      };
    }
  }

  async* generateStreamResponse(
    messages: LLMMessage[],
    context?: any
  ): AsyncGenerator<TrinityStreamChunk, void, unknown> {
    const startTime = Date.now();
    
    try {
      // Send agent start event
      yield {
        type: 'agent_start',
        agentType: this.type,
        content: '',
        delta: '',
        isComplete: false,
        timestamp: Date.now(),
      };

      // Prepare messages with agent-specific system prompt
      const agentMessages: LLMMessage[] = [
        { role: 'system', content: this.config.systemPrompt },
        ...messages,
      ];

      // Get API key from context or use empty string
      const apiKey = context?.apiKey || '';

      // Generate streaming response
      const streamGenerator = generateLLMStreamResponse(agentMessages, {
        model: this.config.model,
        provider: this.config.provider as any,
        apiKey,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        stream: true,
      });

      let content = '';
      
      for await (const chunk of streamGenerator) {
        content = chunk.content;
        
                  const streamMetadata: { confidence?: number; executionTime?: number; tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number } } = {};
          if (chunk.usage) {
            streamMetadata.tokenUsage = chunk.usage;
          }

          yield {
            type: 'agent_chunk',
            agentType: this.type,
            content: chunk.content,
            delta: chunk.delta,
            isComplete: chunk.isComplete,
            timestamp: Date.now(),
            metadata: streamMetadata,
          };
      }

      // Send agent complete event
      const executionTime = Date.now() - startTime;
      const confidence = this.calculateConfidence(content);
      
      yield {
        type: 'agent_complete',
        agentType: this.type,
        content,
        delta: '',
        isComplete: true,
        timestamp: Date.now(),
        metadata: {
          confidence,
          executionTime,
        },
      };
      
    } catch (error) {
      yield {
        type: 'agent_complete',
        agentType: this.type,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        delta: '',
        isComplete: true,
        timestamp: Date.now(),
        metadata: {
          confidence: 0,
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config };
  }

  validateResponse(response: string): boolean {
    // Basic validation - can be overridden by specialized agents
    if (!response || response.trim().length === 0) return false;
    if (response.includes('Error:') && response.length < 50) return false;
    return true;
  }

  protected calculateConfidence(content: string, finishReason?: string): number {
    let confidence = 0.7; // Base confidence
    
    // Adjust based on finish reason
    if (finishReason === 'stop') confidence += 0.2;
    else if (finishReason === 'length') confidence -= 0.1;
    else if (finishReason === 'content_filter') confidence -= 0.3;
    
    // Adjust based on content characteristics
    if (content.length > 100) confidence += 0.1;
    if (content.includes('I think') || content.includes('maybe') || content.includes('possibly')) {
      confidence -= 0.1;
    }
    if (content.includes('definitely') || content.includes('certainly') || content.includes('clearly')) {
      confidence += 0.1;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
}

// Specialized Agent Classes
export class AnalyticalAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({ ...config, type: 'analytical' });
  }

  override validateResponse(response: string): boolean {
    if (!super.validateResponse(response)) return false;
    
    // Analytical responses should have structure and reasoning
    const hasStructure = response.includes('•') || response.includes('-') || 
                        response.includes('1.') || response.includes('firstly') ||
                        response.includes('therefore') || response.includes('analysis');
    
    return hasStructure;
  }

  protected override calculateConfidence(content: string, finishReason?: string): number {
    let confidence = super.calculateConfidence(content, finishReason);
    
    // Boost confidence for analytical markers
    if (content.includes('data') || content.includes('evidence') || 
        content.includes('pattern') || content.includes('conclude')) {
      confidence += 0.1;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
}

export class CreativeAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({ ...config, type: 'creative' });
  }

  override validateResponse(response: string): boolean {
    if (!super.validateResponse(response)) return false;
    
    // Creative responses should show innovation and metaphorical thinking
    const hasCreativity = response.includes('imagine') || response.includes('like') ||
                         response.includes('creative') || response.includes('innovative') ||
                         response.includes('unique') || response.length > 200;
    
    return hasCreativity;
  }

  protected override calculateConfidence(content: string, finishReason?: string): number {
    let confidence = super.calculateConfidence(content, finishReason);
    
    // Boost confidence for creative markers
    if (content.includes('creative') || content.includes('innovative') || 
        content.includes('imagine') || content.includes('metaphor')) {
      confidence += 0.1;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
}

export class FactualAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({ ...config, type: 'factual' });
  }

  override validateResponse(response: string): boolean {
    if (!super.validateResponse(response)) return false;
    
    // Factual responses should be precise and avoid speculation
    const hasSpeculation = response.includes('I think') || response.includes('probably') ||
                          response.includes('might be') || response.includes('seems like');
    
    const hasFactualMarkers = response.includes('according to') || response.includes('research shows') ||
                             response.includes('data indicates') || response.includes('studies');
    
    return !hasSpeculation || hasFactualMarkers;
  }

  protected override calculateConfidence(content: string, finishReason?: string): number {
    let confidence = super.calculateConfidence(content, finishReason);
    
    // Boost confidence for factual markers
    if (content.includes('source') || content.includes('research') || 
        content.includes('study') || content.includes('fact')) {
      confidence += 0.1;
    }
    
    // Reduce confidence for uncertainty markers
    if (content.includes('might') || content.includes('could be')) {
      confidence -= 0.1;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }
}

// Agent Factory
export class AgentFactory {
  static createAgent(config: AgentConfig): Agent {
    switch (config.type) {
      case 'analytical':
        return new AnalyticalAgent(config);
      case 'creative':
        return new CreativeAgent(config);
      case 'factual':
        return new FactualAgent(config);
      default:
        throw new Error(`Unknown agent type: ${config.type}`);
    }
  }

  static createMultipleAgents(configs: AgentConfig[]): Agent[] {
    return configs.map(config => this.createAgent(config));
  }
} 