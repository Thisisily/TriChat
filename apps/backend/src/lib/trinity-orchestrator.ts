import type { 
  Orchestrator, 
  AgentResponse, 
  BlendingStrategy, 
  TrinityResponse,
  AgentType 
} from './trinity-mode.js';
import type { LLMMessage } from './llm.js';
import { generateLLMResponse } from './llm.js';

export class TrinityOrchestrator implements Orchestrator {
  private readonly orchestratorModel: string;
  private readonly orchestratorProvider: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly apiKey: string | undefined;

  constructor(config: {
    model: string;
    provider: string;
    temperature: number;
    maxTokens: number;
    apiKey?: string;
  }) {
    this.orchestratorModel = config.model;
    this.orchestratorProvider = config.provider;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.apiKey = config.apiKey;
  }

  async blendResponses(
    responses: AgentResponse[],
    strategy: BlendingStrategy,
    originalMessages: LLMMessage[],
    apiKey?: string
  ): Promise<string> {
    // Filter out invalid responses
    const validResponses = responses.filter(r => 
      r.content && 
      !r.content.startsWith('Error:') && 
      r.confidence > 0.1
    );

    if (validResponses.length === 0) {
      throw new Error('No valid agent responses to blend');
    }

    if (validResponses.length === 1) {
      return validResponses[0]?.content || '';
    }

    switch (strategy) {
      case 'weighted_merge':
        return this.weightedMerge(validResponses, originalMessages, apiKey);
      case 'best_of_three':
        return this.selectBestResponse(validResponses).content;
      case 'synthesis':
        return this.synthesizeResponses(validResponses, originalMessages, apiKey);
      case 'hierarchical':
        return this.hierarchicalBlend(validResponses, originalMessages, apiKey);
      default:
        throw new Error(`Unknown blending strategy: ${strategy}`);
    }
  }

  generateAttribution(
    responses: AgentResponse[],
    finalResponse: string
  ): TrinityResponse['attribution'] {
    const attribution: TrinityResponse['attribution'] = {};
    
    for (const response of responses) {
      // Calculate contribution percentage based on confidence and content similarity
      const contributionPercentage = this.calculateContribution(response, responses, finalResponse);
      
      // Extract key insights from each agent's response
      const keyInsights = this.extractKeyInsights(response);
      
      attribution[response.agentType] = {
        contributionPercentage,
        keyInsights,
      };
    }

    return attribution;
  }

  resolveConflicts(responses: AgentResponse[]): AgentResponse[] {
    // For now, return responses with confidence adjustment based on conflicts
    return responses.map(response => {
      const conflictCount = this.detectConflicts(response, responses);
      const adjustedConfidence = Math.max(0.1, response.confidence - (conflictCount * 0.15));
      
      return {
        ...response,
        confidence: adjustedConfidence,
      };
    });
  }

  selectBestResponse(responses: AgentResponse[]): AgentResponse {
    if (responses.length === 0) {
      throw new Error('No responses to select from');
    }

    // Score responses based on multiple factors
    const scored = responses.map(response => ({
      response,
      score: this.scoreResponse(response),
    }));

    // Sort by score and return the best
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best) {
      throw new Error('No valid response found');
    }
    return best.response;
  }

  private async weightedMerge(
    responses: AgentResponse[],
    originalMessages: LLMMessage[],
    apiKey?: string
  ): Promise<string> {
    if (!apiKey) throw new Error('Orchestrator requires an API key');
    
    const systemPrompt = `You are an expert orchestrator combining insights from three specialized AI agents.

Your task is to merge their responses into one comprehensive answer that:
1. Preserves the best insights from each agent
2. Respects their confidence levels and specializations
3. Creates a flowing, coherent response
4. Weights contributions based on agent specialization relevance

Agent Specializations:
- Analytical: Logic, reasoning, data analysis, systematic problem-solving
- Creative: Innovation, alternative perspectives, imaginative solutions
- Factual: Accuracy, verification, reliable information, source citation

Original Question: ${originalMessages[originalMessages.length - 1]?.content || 'Unknown'}

Agent Responses:
${responses.map(r => `
**${r.agentType.toUpperCase()} Agent** (Confidence: ${(r.confidence * 100).toFixed(1)}%, Weight: ${(r.metadata.temperature * 100).toFixed(0)}%):
${r.content}
`).join('\n')}

Blend these responses into a single, comprehensive answer that leverages each agent's strengths.`;

    const orchestratorMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Please create a unified response that blends the insights from all agents.' },
    ];

    const llmResponse = await generateLLMResponse(orchestratorMessages, {
      model: this.orchestratorModel,
      provider: this.orchestratorProvider as any,
      apiKey: apiKey || this.apiKey || '',
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      stream: false,
    });

    return llmResponse.content;
  }

  private async synthesizeResponses(
    responses: AgentResponse[],
    originalMessages: LLMMessage[],
    apiKey?: string
  ): Promise<string> {
    if (!apiKey) throw new Error('Orchestrator requires an API key');
    
    const systemPrompt = `You are a master synthesizer creating a new, unified response that incorporates the best elements from three specialized AI agents.

Your goal is to create something greater than the sum of its parts by:
1. Identifying complementary insights across agents
2. Bridging connections between different perspectives
3. Creating novel insights that emerge from the combination
4. Maintaining coherence while adding synthesis value

Do not simply concatenate or summarize - create a genuinely synthesized response.

Original Question: ${originalMessages[originalMessages.length - 1]?.content || 'Unknown'}

Agent Insights:
${responses.map(r => `
[${r.agentType.toUpperCase()}] ${r.content}
`).join('\n')}

Synthesize these into a cohesive, insightful response that creates new value.`;

    const orchestratorMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Create a synthesized response that goes beyond simple combination.' },
    ];

    const llmResponse = await generateLLMResponse(orchestratorMessages, {
      model: this.orchestratorModel,
      provider: this.orchestratorProvider as any,
      apiKey: apiKey || this.apiKey || '',
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      stream: false,
    });

    return llmResponse.content;
  }

  private async hierarchicalBlend(
    responses: AgentResponse[],
    originalMessages: LLMMessage[],
    apiKey?: string
  ): Promise<string> {
    if (!apiKey) throw new Error('Orchestrator requires an API key');
    
    const systemPrompt = `You are organizing insights from three specialized agents into a structured, hierarchical response.

Structure your response with clear sections that highlight each agent's contribution:

**Analysis & Logic** (from Analytical Agent)
**Creative Perspectives** (from Creative Agent)  
**Facts & Verification** (from Factual Agent)
**Integrated Conclusion** (your synthesis)

Make each section distinct but ensure the overall response flows logically.

Original Question: ${originalMessages[originalMessages.length - 1]?.content || 'Unknown'}

Agent Responses:
${responses.map(r => `
[${r.agentType.toUpperCase()}]: ${r.content}
`).join('\n')}

Create a well-structured response with clear sections for each perspective.`;

    const orchestratorMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Create a hierarchically structured response with distinct sections.' },
    ];

    const llmResponse = await generateLLMResponse(orchestratorMessages, {
      model: this.orchestratorModel,
      provider: this.orchestratorProvider as any,
      apiKey: apiKey || this.apiKey || '',
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      stream: false,
    });

    return llmResponse.content;
  }

  private scoreResponse(response: AgentResponse): number {
    let score = response.confidence * 0.4; // Base confidence weight
    
    // Content quality indicators
    if (response.content.length > 100) score += 0.1;
    if (response.content.length > 500) score += 0.1;
    
    // Execution time bonus (faster is better, up to a point)
    if (response.executionTime < 5000) score += 0.1;
    else if (response.executionTime > 30000) score -= 0.1;
    
    // Finish reason quality
    if (response.metadata.finishReason === 'stop') score += 0.1;
    else if (response.metadata.finishReason === 'length') score -= 0.05;
    
    // Agent-specific scoring
    switch (response.agentType) {
      case 'analytical':
        if (response.content.includes('analysis') || response.content.includes('data')) score += 0.1;
        break;
      case 'creative':
        if (response.content.includes('creative') || response.content.includes('innovative')) score += 0.1;
        break;
      case 'factual':
        if (response.content.includes('fact') || response.content.includes('research')) score += 0.1;
        break;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  private calculateContribution(
    response: AgentResponse,
    allResponses: AgentResponse[],
    finalResponse: string
  ): number {
    // Simple heuristic: base on confidence and uniqueness
    const baseContribution = response.confidence * 0.6;
    
    // Uniqueness bonus
    const uniqueness = this.calculateUniqueness(response, allResponses);
    const uniquenessBonus = uniqueness * 0.3;
    
    // Content similarity to final response
    const similarity = this.calculateSimilarity(response.content, finalResponse);
    const similarityBonus = similarity * 0.1;
    
    const total = baseContribution + uniquenessBonus + similarityBonus;
    return Math.max(0, Math.min(1, total));
  }

  private calculateUniqueness(response: AgentResponse, allResponses: AgentResponse[]): number {
    const otherResponses = allResponses.filter(r => r.agentType !== response.agentType);
    let uniqueWords = 0;
    let totalWords = 0;
    
    const responseWords = new Set(response.content.toLowerCase().split(/\s+/));
    const otherWords = new Set();
    
    otherResponses.forEach(r => {
      r.content.toLowerCase().split(/\s+/).forEach(word => otherWords.add(word));
    });
    
    responseWords.forEach(word => {
      totalWords++;
      if (!otherWords.has(word)) uniqueWords++;
    });
    
    return totalWords > 0 ? uniqueWords / totalWords : 0;
  }

  private calculateSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private extractKeyInsights(response: AgentResponse): string[] {
    // Simple extraction based on sentence structure and keywords
    const sentences = response.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const insights: string[] = [];
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      
      // Look for insight indicators
      if (
        trimmed.includes('important') || 
        trimmed.includes('key') || 
        trimmed.includes('crucial') ||
        trimmed.includes('significant') ||
        trimmed.includes('notable') ||
        trimmed.startsWith('This') ||
        trimmed.startsWith('The main') ||
        (response.agentType === 'analytical' && (trimmed.includes('analysis') || trimmed.includes('data'))) ||
        (response.agentType === 'creative' && (trimmed.includes('creative') || trimmed.includes('innovative'))) ||
        (response.agentType === 'factual' && (trimmed.includes('fact') || trimmed.includes('research')))
      ) {
        insights.push(trimmed);
      }
    }
    
    return insights.slice(0, 3); // Limit to 3 key insights per agent
  }

  private detectConflicts(response: AgentResponse, allResponses: AgentResponse[]): number {
    // Simplified conflict detection based on contradictory keywords
    const contradictionPairs = [
      ['yes', 'no'],
      ['true', 'false'],
      ['increase', 'decrease'],
      ['better', 'worse'],
      ['should', 'should not'],
      ['recommend', 'not recommend'],
    ];
    
    let conflicts = 0;
    const responseText = response.content.toLowerCase();
    
    for (const otherResponse of allResponses) {
      if (otherResponse.agentType === response.agentType) continue;
      
      const otherText = otherResponse.content.toLowerCase();
      
      for (const [word1, word2] of contradictionPairs) {
        if (word1 && word2) {
          if (responseText.includes(word1) && otherText.includes(word2)) {
            conflicts++;
          }
          if (responseText.includes(word2) && otherText.includes(word1)) {
            conflicts++;
          }
        }
      }
    }
    
    return conflicts;
  }
} 