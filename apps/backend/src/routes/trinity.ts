import { z } from 'zod';
import { router, authenticatedProcedure } from '../trpc/init.js';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import type { LLMMessage } from '../lib/llm.js';
import { getUserApiKey } from '../lib/llm.js';

// Trinity Mode Input Schemas
const TrinityConfigSchema = z.object({
  executionMode: z.enum(['parallel', 'sequential', 'hybrid']),
  preset: z.string().optional(),
  customConfig: z.any().optional(),
});

export const trinityRouter = router({
  // Send a message using Trinity Mode (3 agents + orchestrator)
  sendMessage: authenticatedProcedure
    .input(z.object({
      threadId: z.string(),
      content: z.string(),
      trinityConfig: TrinityConfigSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify thread ownership
      const thread = await ctx.prisma.thread.findFirst({
        where: {
          id: input.threadId,
          userId: ctx.user.userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
        },
      });

      if (!thread) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Thread not found',
        });
      }

      try {
        // Create user message
        const userMessage = await ctx.prisma.message.create({
          data: {
            threadId: input.threadId,
            userId: ctx.user.userId,
            role: 'user',
            content: input.content,
          },
        });

        // Convert to LLM messages format
        const llmMessages: LLMMessage[] = [
          ...thread.messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
          {
            role: 'user',
            content: input.content,
          },
        ];

        // Import Trinity Mode components
        const { TrinityExecutionManager } = await import('../lib/trinity-manager.js');
        const { DEFAULT_TRINITY_CONFIG, TRINITY_PRESETS } = await import('../lib/trinity-mode.js');
        
        const trinityManager = new TrinityExecutionManager();

        // Debug: Log the incoming configuration
        console.log('Trinity Config Input:', JSON.stringify(input.trinityConfig, null, 2));

        // Determine configuration
        let trinityConfig = DEFAULT_TRINITY_CONFIG;
        if (input.trinityConfig.preset && TRINITY_PRESETS[input.trinityConfig.preset]) {
          trinityConfig = {
            ...DEFAULT_TRINITY_CONFIG,
            ...TRINITY_PRESETS[input.trinityConfig.preset],
            executionMode: input.trinityConfig.executionMode,
          };
        } else if (input.trinityConfig.customConfig) {
          // Handle custom agent models configuration
          const customConfig = input.trinityConfig.customConfig;
          
          // First check if customConfig has the agents property directly (presets)
          if (customConfig.agents) {
            trinityConfig = {
              ...DEFAULT_TRINITY_CONFIG,
              ...customConfig,
              executionMode: input.trinityConfig.executionMode,
            };
          } else {
            // Otherwise build config from agentModels
            trinityConfig = {
              ...DEFAULT_TRINITY_CONFIG,
              executionMode: input.trinityConfig.executionMode,
            };
            
            // Update agent models if provided
            if (customConfig.agentModels) {
              if (customConfig.agentModels.analytical) {
                trinityConfig.agents.analytical = {
                  ...trinityConfig.agents.analytical,
                  model: customConfig.agentModels.analytical.model,
                  provider: customConfig.agentModels.analytical.provider,
                };
              }
              if (customConfig.agentModels.creative) {
                trinityConfig.agents.creative = {
                  ...trinityConfig.agents.creative,
                  model: customConfig.agentModels.creative.model,
                  provider: customConfig.agentModels.creative.provider,
                };
              }
              if (customConfig.agentModels.factual) {
                trinityConfig.agents.factual = {
                  ...trinityConfig.agents.factual,
                  model: customConfig.agentModels.factual.model,
                  provider: customConfig.agentModels.factual.provider,
                };
              }
            }
            
            // Update weights if provided
            if (customConfig.customWeights) {
              trinityConfig.agents.analytical.weight = customConfig.customWeights.analytical;
              trinityConfig.agents.creative.weight = customConfig.customWeights.creative;
              trinityConfig.agents.factual.weight = customConfig.customWeights.factual;
            }
            
            // Update advanced configuration if provided
            if (customConfig.advanced) {
              // Update temperatures if provided
              if (customConfig.advanced.temperatures) {
                if (customConfig.advanced.temperatures.analytical !== undefined) {
                  trinityConfig.agents.analytical.temperature = customConfig.advanced.temperatures.analytical;
                }
                if (customConfig.advanced.temperatures.creative !== undefined) {
                  trinityConfig.agents.creative.temperature = customConfig.advanced.temperatures.creative;
                }
                if (customConfig.advanced.temperatures.factual !== undefined) {
                  trinityConfig.agents.factual.temperature = customConfig.advanced.temperatures.factual;
                }
              }
              
              // Update custom prompts if provided
              if (customConfig.advanced.prompts) {
                if (customConfig.advanced.prompts.analytical) {
                  trinityConfig.agents.analytical.systemPrompt += `\n\nAdditional instructions: ${customConfig.advanced.prompts.analytical}`;
                }
                if (customConfig.advanced.prompts.creative) {
                  trinityConfig.agents.creative.systemPrompt += `\n\nAdditional instructions: ${customConfig.advanced.prompts.creative}`;
                }
                if (customConfig.advanced.prompts.factual) {
                  trinityConfig.agents.factual.systemPrompt += `\n\nAdditional instructions: ${customConfig.advanced.prompts.factual}`;
                }
              }
            }
            
            // Update orchestrator model if provided
            if (customConfig.orchestrator) {
              trinityConfig.orchestrator = {
                ...trinityConfig.orchestrator,
                ...customConfig.orchestrator
              };
            }
          }
        } else {
          trinityConfig = {
            ...DEFAULT_TRINITY_CONFIG,
            executionMode: input.trinityConfig.executionMode,
          };
        }

        // Debug: Log the final configuration
        console.log('Trinity Config Final:', JSON.stringify({
          analytical: trinityConfig.agents.analytical.provider,
          creative: trinityConfig.agents.creative.provider,
          factual: trinityConfig.agents.factual.provider,
        }, null, 2));

        // Get API keys for each agent
        const apiKeys = {
          analytical: await getUserApiKey(ctx.user.userId, trinityConfig.agents.analytical.provider as any, ctx.prisma),
          creative: await getUserApiKey(ctx.user.userId, trinityConfig.agents.creative.provider as any, ctx.prisma),
          factual: await getUserApiKey(ctx.user.userId, trinityConfig.agents.factual.provider as any, ctx.prisma),
        };

        // Fallback to environment variables if database keys are not found
        const envKeyMap: Record<string, string | undefined> = {
          openai: process.env['OPENAI_API_KEY'],
          anthropic: process.env['ANTHROPIC_API_KEY'],
          google: process.env['GOOGLE_API_KEY'],
          mistral: process.env['MISTRAL_API_KEY'],
          openrouter: process.env['OPENROUTER_API_KEY'],
        };

        // Apply fallbacks
        const analyticalEnvKey = envKeyMap[trinityConfig.agents.analytical.provider];
        if (!apiKeys.analytical && analyticalEnvKey) {
          console.log(`Using env fallback for analytical agent (${trinityConfig.agents.analytical.provider})`);
          apiKeys.analytical = analyticalEnvKey;
        }
        const creativeEnvKey = envKeyMap[trinityConfig.agents.creative.provider];
        if (!apiKeys.creative && creativeEnvKey) {
          console.log(`Using env fallback for creative agent (${trinityConfig.agents.creative.provider})`);
          apiKeys.creative = creativeEnvKey;
        }
        const factualEnvKey = envKeyMap[trinityConfig.agents.factual.provider];
        if (!apiKeys.factual && factualEnvKey) {
          console.log(`Using env fallback for factual agent (${trinityConfig.agents.factual.provider})`);
          apiKeys.factual = factualEnvKey;
        }

        // Debug: Log API key status
        console.log('API Keys Status:', {
          analytical: { 
            provider: trinityConfig.agents.analytical.provider, 
            hasKey: !!apiKeys.analytical,
            keyLength: apiKeys.analytical?.length || 0
          },
          creative: { 
            provider: trinityConfig.agents.creative.provider, 
            hasKey: !!apiKeys.creative,
            keyLength: apiKeys.creative?.length || 0
          },
          factual: { 
            provider: trinityConfig.agents.factual.provider, 
            hasKey: !!apiKeys.factual,
            keyLength: apiKeys.factual?.length || 0
          },
        });

        // Check if all required API keys are available
        // Only check unique providers that are actually being used
        const uniqueProviders = new Set([
          trinityConfig.agents.analytical.provider,
          trinityConfig.agents.creative.provider,
          trinityConfig.agents.factual.provider,
        ]);
        
        const missingProviders: string[] = [];
        for (const provider of uniqueProviders) {
          // Check if any of the agents using this provider has a missing API key
          if (
            (trinityConfig.agents.analytical.provider === provider && !apiKeys.analytical) ||
            (trinityConfig.agents.creative.provider === provider && !apiKeys.creative) ||
            (trinityConfig.agents.factual.provider === provider && !apiKeys.factual)
          ) {
            missingProviders.push(provider);
          }
        }

        if (missingProviders.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Missing API keys for providers: ${missingProviders.join(', ')}`,
          });
        }

        // Execute Trinity Mode
        let trinityResponse;
        switch (trinityConfig.executionMode) {
          case 'parallel':
            trinityResponse = await trinityManager.executeParallel(llmMessages, trinityConfig, apiKeys);
            break;
          case 'sequential':
            trinityResponse = await trinityManager.executeSequential(llmMessages, trinityConfig, apiKeys);
            break;
          case 'hybrid':
            trinityResponse = await trinityManager.executeHybrid(llmMessages, trinityConfig, apiKeys);
            break;
          default:
            throw new Error(`Unknown execution mode: ${trinityConfig.executionMode}`);
        }

        // Create assistant message with Trinity response
        console.log('Trinity Response Debug:', {
          finalResponseType: typeof trinityResponse.finalResponse,
          finalResponseLength: trinityResponse.finalResponse?.length,
          finalResponsePreview: trinityResponse.finalResponse?.substring(0, 100),
          agentCount: trinityResponse.agentResponses.length
        });

        // Ensure finalResponse is a string
        const messageContent = typeof trinityResponse.finalResponse === 'string' 
          ? trinityResponse.finalResponse 
          : JSON.stringify(trinityResponse.finalResponse);

        const assistantMessage = await ctx.prisma.message.create({
          data: {
            threadId: input.threadId,
            userId: ctx.user.userId,
            role: 'assistant',
            content: messageContent,
            model: 'trinity-mode',
            provider: 'trinity',
          },
        });

        // Store Trinity data for the UI
        console.log('Storing Trinity data:', {
          messageId: assistantMessage.id,
          agentResponsesCount: trinityResponse.agentResponses.length,
          agentResponses: trinityResponse.agentResponses.map(r => ({
            agentType: r.agentType,
            contentLength: r.content?.length,
            contentPreview: r.content?.substring(0, 50) + '...'
          })),
          hasAttribution: !!trinityResponse.attribution
        });

        const trinityData = {
          ...trinityResponse,
          messageId: assistantMessage.id
        };

        await ctx.prisma.$executeRaw`
          INSERT INTO trinity_responses (message_id, data)
          VALUES (${assistantMessage.id}, ${JSON.stringify(trinityData)}::jsonb)
          ON CONFLICT (message_id) 
          DO UPDATE SET data = EXCLUDED.data
        `;

        return {
          userMessage,
          assistantMessage,
          trinityData: {
            agentResponses: trinityResponse.agentResponses,
            attribution: trinityResponse.attribution,
            orchestratorMetadata: trinityResponse.orchestratorMetadata,
            finalResponse: trinityResponse.finalResponse,
          },
        };

      } catch (error) {
        console.error('Trinity mode error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Trinity mode execution failed',
        });
      }
    }),

  // Stream Trinity Mode response in real-time
  streamResponse: authenticatedProcedure
    .input(z.object({
      threadId: z.string(),
      content: z.string(),
      trinityConfig: TrinityConfigSchema,
    }))
    .subscription(async function* ({ input, ctx }) {
      // Verify thread ownership
      const thread = await ctx.prisma.thread.findFirst({
        where: {
          id: input.threadId,
          userId: ctx.user.userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
        },
      });

      if (!thread) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Thread not found',
        });
      }

      try {
        // Create user message
        const userMessage = await ctx.prisma.message.create({
          data: {
            threadId: input.threadId,
            userId: ctx.user.userId,
            role: 'user',
            content: input.content,
          },
        });

        yield {
          type: 'user_message',
          message: userMessage,
        };

        // Convert to LLM messages format
        const llmMessages: LLMMessage[] = [
          ...thread.messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
          {
            role: 'user',
            content: input.content,
          },
        ];

        // Import Trinity Mode components
        const { TrinityExecutionManager } = await import('../lib/trinity-manager.js');
        const { DEFAULT_TRINITY_CONFIG, TRINITY_PRESETS } = await import('../lib/trinity-mode.js');
        
        const trinityManager = new TrinityExecutionManager();

        // Debug: Log the incoming configuration
        console.log('Trinity Config Input:', JSON.stringify(input.trinityConfig, null, 2));

        // Determine configuration
        let trinityConfig = DEFAULT_TRINITY_CONFIG;
        if (input.trinityConfig.preset && TRINITY_PRESETS[input.trinityConfig.preset]) {
          trinityConfig = {
            ...DEFAULT_TRINITY_CONFIG,
            ...TRINITY_PRESETS[input.trinityConfig.preset],
            executionMode: input.trinityConfig.executionMode,
          };
        } else if (input.trinityConfig.customConfig) {
          // Handle custom agent models configuration
          const customConfig = input.trinityConfig.customConfig;
          
          // First check if customConfig has the agents property directly (presets)
          if (customConfig.agents) {
            trinityConfig = {
              ...DEFAULT_TRINITY_CONFIG,
              ...customConfig,
              executionMode: input.trinityConfig.executionMode,
            };
          } else {
            // Otherwise build config from agentModels
            trinityConfig = {
              ...DEFAULT_TRINITY_CONFIG,
              executionMode: input.trinityConfig.executionMode,
            };
            
            // Update agent models if provided
            if (customConfig.agentModels) {
              if (customConfig.agentModels.analytical) {
                trinityConfig.agents.analytical = {
                  ...trinityConfig.agents.analytical,
                  model: customConfig.agentModels.analytical.model,
                  provider: customConfig.agentModels.analytical.provider,
                };
              }
              if (customConfig.agentModels.creative) {
                trinityConfig.agents.creative = {
                  ...trinityConfig.agents.creative,
                  model: customConfig.agentModels.creative.model,
                  provider: customConfig.agentModels.creative.provider,
                };
              }
              if (customConfig.agentModels.factual) {
                trinityConfig.agents.factual = {
                  ...trinityConfig.agents.factual,
                  model: customConfig.agentModels.factual.model,
                  provider: customConfig.agentModels.factual.provider,
                };
              }
            }
            
            // Update weights if provided
            if (customConfig.customWeights) {
              trinityConfig.agents.analytical.weight = customConfig.customWeights.analytical;
              trinityConfig.agents.creative.weight = customConfig.customWeights.creative;
              trinityConfig.agents.factual.weight = customConfig.customWeights.factual;
            }
            
            // Update advanced configuration if provided
            if (customConfig.advanced) {
              // Update temperatures if provided
              if (customConfig.advanced.temperatures) {
                if (customConfig.advanced.temperatures.analytical !== undefined) {
                  trinityConfig.agents.analytical.temperature = customConfig.advanced.temperatures.analytical;
                }
                if (customConfig.advanced.temperatures.creative !== undefined) {
                  trinityConfig.agents.creative.temperature = customConfig.advanced.temperatures.creative;
                }
                if (customConfig.advanced.temperatures.factual !== undefined) {
                  trinityConfig.agents.factual.temperature = customConfig.advanced.temperatures.factual;
                }
              }
              
              // Update custom prompts if provided
              if (customConfig.advanced.prompts) {
                if (customConfig.advanced.prompts.analytical) {
                  trinityConfig.agents.analytical.systemPrompt += `\n\nAdditional instructions: ${customConfig.advanced.prompts.analytical}`;
                }
                if (customConfig.advanced.prompts.creative) {
                  trinityConfig.agents.creative.systemPrompt += `\n\nAdditional instructions: ${customConfig.advanced.prompts.creative}`;
                }
                if (customConfig.advanced.prompts.factual) {
                  trinityConfig.agents.factual.systemPrompt += `\n\nAdditional instructions: ${customConfig.advanced.prompts.factual}`;
                }
              }
            }
            
            // Update orchestrator model if provided
            if (customConfig.orchestrator) {
              trinityConfig.orchestrator = {
                ...trinityConfig.orchestrator,
                ...customConfig.orchestrator
              };
            }
          }
        } else {
          trinityConfig = {
            ...DEFAULT_TRINITY_CONFIG,
            executionMode: input.trinityConfig.executionMode,
          };
        }

        // Debug: Log the final configuration
        console.log('Trinity Config Final:', JSON.stringify({
          analytical: trinityConfig.agents.analytical.provider,
          creative: trinityConfig.agents.creative.provider,
          factual: trinityConfig.agents.factual.provider,
        }, null, 2));

        // Get API keys for each agent
        const apiKeys = {
          analytical: await getUserApiKey(ctx.user.userId, trinityConfig.agents.analytical.provider as any, ctx.prisma),
          creative: await getUserApiKey(ctx.user.userId, trinityConfig.agents.creative.provider as any, ctx.prisma),
          factual: await getUserApiKey(ctx.user.userId, trinityConfig.agents.factual.provider as any, ctx.prisma),
        };

        // Fallback to environment variables if database keys are not found
        const envKeyMap: Record<string, string | undefined> = {
          openai: process.env['OPENAI_API_KEY'],
          anthropic: process.env['ANTHROPIC_API_KEY'],
          google: process.env['GOOGLE_API_KEY'],
          mistral: process.env['MISTRAL_API_KEY'],
          openrouter: process.env['OPENROUTER_API_KEY'],
        };

        // Apply fallbacks
        const analyticalEnvKey = envKeyMap[trinityConfig.agents.analytical.provider];
        if (!apiKeys.analytical && analyticalEnvKey) {
          console.log(`Using env fallback for analytical agent (${trinityConfig.agents.analytical.provider})`);
          apiKeys.analytical = analyticalEnvKey;
        }
        const creativeEnvKey = envKeyMap[trinityConfig.agents.creative.provider];
        if (!apiKeys.creative && creativeEnvKey) {
          console.log(`Using env fallback for creative agent (${trinityConfig.agents.creative.provider})`);
          apiKeys.creative = creativeEnvKey;
        }
        const factualEnvKey = envKeyMap[trinityConfig.agents.factual.provider];
        if (!apiKeys.factual && factualEnvKey) {
          console.log(`Using env fallback for factual agent (${trinityConfig.agents.factual.provider})`);
          apiKeys.factual = factualEnvKey;
        }

        // Debug: Log API key status
        console.log('API Keys Status:', {
          analytical: { 
            provider: trinityConfig.agents.analytical.provider, 
            hasKey: !!apiKeys.analytical,
            keyLength: apiKeys.analytical?.length || 0
          },
          creative: { 
            provider: trinityConfig.agents.creative.provider, 
            hasKey: !!apiKeys.creative,
            keyLength: apiKeys.creative?.length || 0
          },
          factual: { 
            provider: trinityConfig.agents.factual.provider, 
            hasKey: !!apiKeys.factual,
            keyLength: apiKeys.factual?.length || 0
          },
        });

        // Check if all required API keys are available
        // Only check unique providers that are actually being used
        const uniqueProviders = new Set([
          trinityConfig.agents.analytical.provider,
          trinityConfig.agents.creative.provider,
          trinityConfig.agents.factual.provider,
        ]);
        
        const missingProviders: string[] = [];
        for (const provider of uniqueProviders) {
          // Check if any of the agents using this provider has a missing API key
          if (
            (trinityConfig.agents.analytical.provider === provider && !apiKeys.analytical) ||
            (trinityConfig.agents.creative.provider === provider && !apiKeys.creative) ||
            (trinityConfig.agents.factual.provider === provider && !apiKeys.factual)
          ) {
            missingProviders.push(provider);
          }
        }

        if (missingProviders.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Missing API keys for providers: ${missingProviders.join(', ')}`,
          });
        }

        // Stream Trinity Mode execution
        let assistantMessage: any = null;
        const agentResponses: any[] = [];
        
        for await (const chunk of trinityManager.streamTrinityResponse(llmMessages, trinityConfig, apiKeys)) {
          // Handle agent updates
          if (chunk.type === 'agent_start') {
            yield {
              type: 'agent_start',
              agentType: chunk.agentType,
              timestamp: chunk.timestamp,
            };
          } else if (chunk.type === 'agent_chunk') {
            yield {
              type: 'agent_chunk',
              agentType: chunk.agentType,
              content: chunk.content,
              delta: chunk.delta,
              isComplete: chunk.isComplete,
            };
          } else if (chunk.type === 'agent_complete') {
            agentResponses.push({
              agentType: chunk.agentType,
              content: chunk.content,
              metadata: chunk.metadata,
            });
            
            yield {
              type: 'agent_complete',
              agentType: chunk.agentType,
              content: chunk.content,
              metadata: chunk.metadata,
            };
          } else if (chunk.type === 'orchestrator_chunk') {
            // Create assistant message if not exists
            if (!assistantMessage) {
              assistantMessage = await ctx.prisma.message.create({
                data: {
                  threadId: input.threadId,
                  userId: ctx.user.userId,
                  role: 'assistant',
                  content: '',
                  model: 'trinity-mode',
                  provider: 'trinity',
                },
              });
            }

            // Update message content
            await ctx.prisma.message.update({
              where: { id: assistantMessage.id },
              data: { content: chunk.content },
            });

            yield {
              type: 'orchestrator_chunk',
              messageId: assistantMessage.id,
              content: chunk.content,
              delta: chunk.delta,
            };
          } else if (chunk.type === 'trinity_complete') {
            if (assistantMessage) {
              // Final update
              await ctx.prisma.message.update({
                where: { id: assistantMessage.id },
                data: {
                  content: chunk.content,
                },
              });
            }

            yield {
              type: 'trinity_complete',
              messageId: assistantMessage?.id,
              content: chunk.content,
              agentResponses,
            };
          }
        }

      } catch (error) {
        console.error('Trinity streaming error:', error);
        yield {
          type: 'error',
          error: error instanceof Error ? error.message : 'Trinity streaming failed',
        };
      }
    }),

  // Get Trinity Mode presets
  getPresets: authenticatedProcedure
    .query(async ({ ctx }) => {
      const { TRINITY_PRESETS, DEFAULT_TRINITY_CONFIG } = await import('../lib/trinity-mode.js');
      
      return {
        defaultConfig: DEFAULT_TRINITY_CONFIG,
        presets: Object.entries(TRINITY_PRESETS).map(([key, preset]) => ({
          id: key,
          name: key.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '),
          config: preset,
        })),
      };
    }),

  // Validate Trinity Mode configuration
  validateConfig: authenticatedProcedure
    .input(z.any())
    .query(async ({ input, ctx }) => {
      const { TrinityConfigSchema } = await import('../lib/trinity-mode.js');
      
      try {
        TrinityConfigSchema.parse(input);
        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          errors: error instanceof Error ? error.message : 'Invalid configuration',
        };
      }
    }),

  // Get available models for Trinity Mode agents
  getAvailableModels: authenticatedProcedure
    .query(async ({ ctx }) => {
      const { validateModelForProvider } = await import('../lib/llm.js');
      
      return {
        openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        openrouter: [
          'openai/gpt-4o',
          'anthropic/claude-3-5-sonnet',
          'google/gemini-pro-1.5',
          'meta-llama/llama-3-70b-instruct',
          'mistralai/mixtral-8x7b-instruct',
        ],
      };
    }),

  // Test Trinity Mode with a simple query
  test: authenticatedProcedure
    .input(z.object({
      query: z.string(),
      executionMode: z.enum(['parallel', 'sequential', 'hybrid']).default('parallel'),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { TrinityExecutionManager } = await import('../lib/trinity-manager.js');
        const { DEFAULT_TRINITY_CONFIG } = await import('../lib/trinity-mode.js');
        
        const trinityManager = new TrinityExecutionManager();
        
        const testConfig = {
          ...DEFAULT_TRINITY_CONFIG,
          executionMode: input.executionMode,
        };

        const messages: LLMMessage[] = [
          { role: 'user', content: input.query },
        ];

        let trinityResponse;
        switch (input.executionMode) {
          case 'parallel':
            trinityResponse = await trinityManager.executeParallel(messages, testConfig);
            break;
          case 'sequential':
            trinityResponse = await trinityManager.executeSequential(messages, testConfig);
            break;
          case 'hybrid':
            trinityResponse = await trinityManager.executeHybrid(messages, testConfig);
            break;
        }

        return {
          query: input.query,
          executionMode: input.executionMode,
          response: trinityResponse.finalResponse,
          agentResponses: trinityResponse.agentResponses,
          attribution: trinityResponse.attribution,
          metadata: trinityResponse.orchestratorMetadata,
        };

      } catch (error) {
        console.error('Trinity test error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Trinity test failed',
        });
      }
    }),
}); 