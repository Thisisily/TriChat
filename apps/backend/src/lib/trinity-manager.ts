import type { 
  TrinityManager, 
  TrinityConfig, 
  TrinityResponse, 
  TrinityStreamChunk, 
  AgentResponse,
  Agent,
  Orchestrator 
} from './trinity-mode.js';
import type { LLMMessage } from './llm.js';
import { TrinityOrchestrator } from './trinity-orchestrator.js';
import { AgentFactory } from './trinity-agents.js';
import { DEFAULT_TRINITY_CONFIG, TrinityConfigSchema } from './trinity-mode.js';

export class TrinityExecutionManager implements TrinityManager {
  private orchestrator: Orchestrator;
  private agents: Map<string, Agent> = new Map();

  constructor() {
    // Initialize with default orchestrator config
    this.orchestrator = new TrinityOrchestrator({
      model: DEFAULT_TRINITY_CONFIG.orchestrator.model,
      provider: DEFAULT_TRINITY_CONFIG.orchestrator.provider,
      temperature: DEFAULT_TRINITY_CONFIG.orchestrator.temperature,
      maxTokens: DEFAULT_TRINITY_CONFIG.orchestrator.maxTokens,
    });
  }

  async executeParallel(
    messages: LLMMessage[],
    config: TrinityConfig,
    apiKeys?: { analytical: string | null; creative: string | null; factual: string | null }
  ): Promise<TrinityResponse> {
    const startTime = Date.now();
    
    try {
      // Get enabled agents
      const enabledAgents = this.getEnabledAgents(config);
      
      if (enabledAgents.length === 0) {
        throw new Error('No enabled agents in configuration');
      }

      // Execute all agents in parallel with timeout
      const agentPromises = enabledAgents.map((agent, index) => {
        const apiKey = apiKeys?.[agent.type] || '';
        console.log(`Agent ${agent.type} using provider ${agent.config.provider}, has API key: ${!!apiKey}`);
        // Add a small delay between agent calls to avoid rate limiting
        return new Promise<AgentResponse>((resolve, reject) => {
          setTimeout(() => {
            this.executeAgentWithTimeout(agent, messages, config.timeout, { apiKey })
              .then(resolve)
              .catch(reject);
          }, index * 500);
        });
      });

      const agentResponses = await Promise.allSettled(agentPromises);
      
      // Filter successful responses
      const successfulResponses: AgentResponse[] = agentResponses
        .filter((result): result is PromiseFulfilledResult<AgentResponse> => result.status === 'fulfilled')
        .map(result => result.value);

      if (successfulResponses.length === 0) {
        // Only fallback if ALL agents fail
        if (config.fallbackToSingleAgent) {
          return this.executeFallback(messages, config, agentResponses, apiKeys);
        }
        throw new Error('All agents failed to respond');
      } else if (successfulResponses.length < enabledAgents.length) {
        // If some agents failed, log a warning but proceed with successful ones
        console.warn('One or more agents failed to respond. Proceeding with successful responses.');
      }

      // Resolve conflicts and blend responses
      const resolvedResponses = this.orchestrator.resolveConflicts(successfulResponses);
      // Use the first available API key for the orchestrator (since all agents are using OpenAI)
      const orchestratorApiKey = apiKeys?.analytical || apiKeys?.creative || apiKeys?.factual || '';
      const finalResponse = await this.orchestrator.blendResponses(
        resolvedResponses,
        config.orchestrator.blendingStrategy,
        messages,
        orchestratorApiKey
      );

      const totalExecutionTime = Date.now() - startTime;
      
      // Generate attribution
      const attribution = this.orchestrator.generateAttribution(resolvedResponses, finalResponse);

      return {
        finalResponse,
        agentResponses: resolvedResponses,
        orchestratorMetadata: {
          blendingStrategy: config.orchestrator.blendingStrategy,
          executionMode: 'parallel',
          totalExecutionTime,
          tokenUsage: this.aggregateTokenUsage(resolvedResponses),
        },
        attribution,
      };

    } catch (error) {
      if (config.fallbackToSingleAgent) {
        return this.executeFallback(messages, config, [], apiKeys);
      }
      throw error;
    }
  }

  async executeSequential(
    messages: LLMMessage[],
    config: TrinityConfig,
    apiKeys?: { analytical: string | null; creative: string | null; factual: string | null }
  ): Promise<TrinityResponse> {
    const startTime = Date.now();
    const agentResponses: AgentResponse[] = [];
    
    try {
      const enabledAgents = this.getEnabledAgents(config);
      
      if (enabledAgents.length === 0) {
        throw new Error('No enabled agents in configuration');
      }

      // Execute agents sequentially, passing previous responses as context
      for (const agent of enabledAgents) {
        try {
          const apiKey = apiKeys?.[agent.type];
          if (!apiKey) {
            throw new Error(`Missing API key for ${agent.type} agent using ${agent.config.provider}`);
          }
          const context = {
            previousResponses: agentResponses,
            isSequential: true,
            apiKey,
          };
          
          const response = await this.executeAgentWithTimeout(
            agent, 
            messages, 
            config.timeout,
            context
          );
          
          agentResponses.push(response);
        } catch (error) {
          console.warn(`Agent ${agent.type} failed in sequential execution:`, error);
          
          if (!config.fallbackToSingleAgent) {
            throw error;
          }
        }
      }

      if (agentResponses.length === 0) {
        if (config.fallbackToSingleAgent) {
          return this.executeFallback(messages, config, [], apiKeys);
        }
        throw new Error('All agents failed in sequential execution');
      }

      // Blend responses
      const resolvedResponses = this.orchestrator.resolveConflicts(agentResponses);
      // Use the first available API key for the orchestrator
      const orchestratorApiKey = apiKeys?.analytical || apiKeys?.creative || apiKeys?.factual || '';
      const finalResponse = await this.orchestrator.blendResponses(
        resolvedResponses,
        config.orchestrator.blendingStrategy,
        messages,
        orchestratorApiKey
      );

      const totalExecutionTime = Date.now() - startTime;
      const attribution = this.orchestrator.generateAttribution(resolvedResponses, finalResponse);

      return {
        finalResponse,
        agentResponses: resolvedResponses,
        orchestratorMetadata: {
          blendingStrategy: config.orchestrator.blendingStrategy,
          executionMode: 'sequential',
          totalExecutionTime,
          tokenUsage: this.aggregateTokenUsage(resolvedResponses),
        },
        attribution,
      };

    } catch (error) {
      if (config.fallbackToSingleAgent) {
        return this.executeFallback(messages, config, [], apiKeys);
      }
      throw error;
    }
  }

  async executeHybrid(
    messages: LLMMessage[],
    config: TrinityConfig,
    apiKeys?: { analytical: string | null; creative: string | null; factual: string | null }
  ): Promise<TrinityResponse> {
    // Hybrid mode: Execute factual and analytical in parallel, then creative with their context
    const startTime = Date.now();
    
    try {
      const enabledAgents = this.getEnabledAgents(config);
      const factualAgent = enabledAgents.find(a => a.type === 'factual');
      const analyticalAgent = enabledAgents.find(a => a.type === 'analytical');
      const creativeAgent = enabledAgents.find(a => a.type === 'creative');

      // Phase 1: Execute factual and analytical in parallel
      const phase1Agents = [factualAgent, analyticalAgent].filter(Boolean) as Agent[];
      const phase1Promises = phase1Agents.map(agent => {
        const apiKey = apiKeys?.[agent.type];
        if (!apiKey) {
          throw new Error(`Missing API key for ${agent.type} agent using ${agent.config.provider}`);
        }
        return this.executeAgentWithTimeout(agent, messages, config.timeout, { apiKey });
      });

      const phase1Results = await Promise.allSettled(phase1Promises);
      const phase1Responses = phase1Results
        .filter((result): result is PromiseFulfilledResult<AgentResponse> => result.status === 'fulfilled')
        .map(result => result.value);

      // Phase 2: Execute creative agent with context from phase 1
      const allResponses = [...phase1Responses];
      
      if (creativeAgent) {
        try {
          const apiKey = apiKeys?.creative;
          if (!apiKey) {
            throw new Error(`Missing API key for creative agent using ${creativeAgent.config.provider}`);
          }
          const context = {
            previousResponses: phase1Responses,
            isHybrid: true,
            apiKey,
          };
          
          const creativeResponse = await this.executeAgentWithTimeout(
            creativeAgent, 
            messages, 
            config.timeout,
            context
          );
          
          allResponses.push(creativeResponse);
        } catch (error) {
          console.warn('Creative agent failed in hybrid execution:', error);
        }
      }

      if (allResponses.length === 0) {
        if (config.fallbackToSingleAgent) {
          return this.executeFallback(messages, config, [], apiKeys);
        }
        throw new Error('All agents failed in hybrid execution');
      }

      // Blend responses
      const resolvedResponses = this.orchestrator.resolveConflicts(allResponses);
      // Use the first available API key for the orchestrator
      const orchestratorApiKey = apiKeys?.analytical || apiKeys?.creative || apiKeys?.factual || '';
      const finalResponse = await this.orchestrator.blendResponses(
        resolvedResponses,
        config.orchestrator.blendingStrategy,
        messages,
        orchestratorApiKey
      );

      const totalExecutionTime = Date.now() - startTime;
      const attribution = this.orchestrator.generateAttribution(resolvedResponses, finalResponse);

      return {
        finalResponse,
        agentResponses: resolvedResponses,
        orchestratorMetadata: {
          blendingStrategy: config.orchestrator.blendingStrategy,
          executionMode: 'hybrid',
          totalExecutionTime,
          tokenUsage: this.aggregateTokenUsage(resolvedResponses),
        },
        attribution,
      };

    } catch (error) {
      if (config.fallbackToSingleAgent) {
        return this.executeFallback(messages, config, [], apiKeys);
      }
      throw error;
    }
  }

  async* streamTrinityResponse(
    messages: LLMMessage[],
    config: TrinityConfig,
    apiKeys?: { analytical: string | null; creative: string | null; factual: string | null }
  ): AsyncGenerator<TrinityStreamChunk, void, unknown> {
    // For streaming, we'll use parallel execution with real-time updates
    const enabledAgents = this.getEnabledAgents(config);
    
    if (enabledAgents.length === 0) {
      throw new Error('No enabled agents in configuration');
    }

    // Start all agent streams
    const agentStreams = enabledAgents.map(agent => {
      const apiKey = apiKeys?.[agent.type];
      if (!apiKey) {
        throw new Error(`Missing API key for ${agent.type} agent using ${agent.config.provider}`);
      }
      return {
        agent,
        stream: agent.generateStreamResponse(messages, { apiKey }),
      };
    });

    const agentResponses: AgentResponse[] = [];
    const completedAgents = new Set<string>();
    
    // Process streams in parallel
    const streamProcessors = agentStreams.map(({ agent, stream }) => ({
      agent,
      stream,
      chunks: [] as TrinityStreamChunk[],
    }));

    // Collect all chunks from all agents
    for (const processor of streamProcessors) {
      const chunks: TrinityStreamChunk[] = [];
      for await (const chunk of processor.stream) {
        chunks.push(chunk);
        yield chunk;
        
        if (chunk.type === 'agent_complete') {
          completedAgents.add(processor.agent.type);
          
          // Store completed response
          agentResponses.push({
            agentType: processor.agent.type,
            content: chunk.content,
            confidence: chunk.metadata?.confidence || 0.7,
            executionTime: chunk.metadata?.executionTime || 0,
            tokenUsage: chunk.metadata?.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            metadata: {
              model: processor.agent.config.model,
              provider: processor.agent.config.provider,
              temperature: processor.agent.config.temperature,
            },
          });
        }
      }
      processor.chunks = chunks;
    }

    // Once all agents are done, start orchestrator
    if (agentResponses.length > 0) {
      const resolvedResponses = this.orchestrator.resolveConflicts(agentResponses);
      // Use the first available API key for the orchestrator
      const orchestratorApiKey = apiKeys?.analytical || apiKeys?.creative || apiKeys?.factual || '';
      const finalResponse = await this.orchestrator.blendResponses(
        resolvedResponses,
        config.orchestrator.blendingStrategy,
        messages,
        orchestratorApiKey
      );

      // Stream the final orchestrated response
      yield {
        type: 'orchestrator_chunk',
        content: finalResponse,
        delta: finalResponse,
        isComplete: false,
        timestamp: Date.now(),
      };

      yield {
        type: 'trinity_complete',
        content: finalResponse,
        delta: '',
        isComplete: true,
        timestamp: Date.now(),
      };
    }
  }

  getDefaultConfig(): TrinityConfig {
    return DEFAULT_TRINITY_CONFIG;
  }

  validateConfig(config: TrinityConfig): boolean {
    try {
      TrinityConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods
  private getEnabledAgents(config: TrinityConfig): Agent[] {
    const agents: Agent[] = [];
    
    for (const [type, agentConfig] of Object.entries(config.agents)) {
      if (agentConfig.enabled) {
        let agent = this.agents.get(type);
        if (!agent) {
          agent = AgentFactory.createAgent(agentConfig);
          this.agents.set(type, agent);
        } else {
          agent.updateConfig(agentConfig);
        }
        agents.push(agent);
      }
    }
    
    return agents;
  }

  private async executeAgentWithTimeout(
    agent: Agent,
    messages: LLMMessage[],
    timeout: number,
    context?: any
  ): Promise<AgentResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Agent ${agent.type} timed out after ${timeout}ms`));
      }, timeout);

      agent.generateResponse(messages, context)
        .then(response => {
          clearTimeout(timer);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeFallback(
    messages: LLMMessage[],
    config: TrinityConfig,
    _failedResults: any[],
    apiKeys?: { analytical: string | null; creative: string | null; factual: string | null }
  ): Promise<TrinityResponse> {
    // Try to find the best available agent for fallback
    const enabledAgents = this.getEnabledAgents(config);
    
    if (enabledAgents.length === 0) {
      throw new Error('No agents available for fallback');
    }

    // Use the agent with highest confidence/weight
    const bestAgent = enabledAgents.reduce((best, current) => 
      current.config.weight > best.config.weight ? current : best
    );

    try {
      const fallbackResponse = await this.executeAgentWithTimeout(bestAgent, messages, config.timeout, { apiKey: apiKeys?.[bestAgent.type] || '' });
      
      return {
        finalResponse: fallbackResponse.content,
        agentResponses: [fallbackResponse],
        orchestratorMetadata: {
          blendingStrategy: 'best_of_three',
          executionMode: config.executionMode,
          totalExecutionTime: fallbackResponse.executionTime,
          tokenUsage: fallbackResponse.tokenUsage,
        },
        attribution: {
          [fallbackResponse.agentType]: {
            contributionPercentage: 1.0,
            keyInsights: ['Fallback response from single agent'],
          },
        },
      };
    } catch (error) {
      throw new Error(`Fallback execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private aggregateTokenUsage(responses: AgentResponse[]) {
    return responses.reduce(
      (total, response) => ({
        promptTokens: total.promptTokens + response.tokenUsage.promptTokens,
        completionTokens: total.completionTokens + response.tokenUsage.completionTokens,
        totalTokens: total.totalTokens + response.tokenUsage.totalTokens,
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }
} 