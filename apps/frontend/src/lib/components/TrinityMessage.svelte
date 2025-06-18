<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createMarkdownParser, markdownUtils } from '../markdown-parser';
  import LoadingSpinner from './LoadingSpinner.svelte';
  import EnhancedGlass from './EnhancedGlass.svelte';
  import { currentMessages, trinityResponses } from '../stores/threads';
  import type { Message } from '../stores/threads';

  // Props
  export let messageId: string | undefined = undefined;
  export let threadId: string | undefined = undefined;
  export let autoStart: boolean = false;
  export let enableMarkdown: boolean = true;
  export let className: string = '';
  export let onComplete: ((content: string) => void) | undefined = undefined;
  export let onError: ((error: string) => void) | undefined = undefined;

  let finalResponse = '';
  let isOrchestratorComplete = false;
  let error: string | null = null;
  let isLoading = true;
  let trinityData: any = null;
  let message: Message | null = null;

  // Agent metadata
  const agentInfo = {
    analytical: { icon: '🔍', label: 'Analytical', color: 'blue' },
    creative: { icon: '🎨', label: 'Creative', color: 'purple' },
    factual: { icon: '📊', label: 'Factual', color: 'green' }
  };

  // Load Trinity data from stores
  function loadTrinityData() {
    if (!messageId) return;
    
    // Find the message in current messages
    const messages = $currentMessages;
    message = messages.find(m => m.id === messageId) || null;
    
    if (message) {
      // Get Trinity data from store
      const responses = $trinityResponses;
      trinityData = responses[messageId] || null;
      
      console.log('TrinityMessage - Raw message:', message);
      console.log('TrinityMessage - Message content type:', typeof message.content);
      console.log('TrinityMessage - Message content:', message.content);
      
      if (trinityData) {
        // Check if we have a finalResponse in trinityData
        if (trinityData.finalResponse && typeof trinityData.finalResponse === 'string') {
          finalResponse = trinityData.finalResponse;
        } else {
          finalResponse = typeof message.content === 'string' ? message.content : '';
        }
        
        console.log('Trinity Message Debug:', {
          messageId,
          messageContent: message.content,
          messageContentType: typeof message.content,
          trinityData,
          finalResponse,
          hasFinalResponse: !!trinityData.finalResponse
        });
        console.log('Trinity Data Details:', {
          hasAgentResponses: !!trinityData?.agentResponses,
          agentResponsesLength: trinityData?.agentResponses?.length,
          agentResponses: trinityData?.agentResponses,
          attribution: trinityData?.attribution
        });
        
        // Log each agent response in detail
        if (trinityData?.agentResponses) {
          trinityData.agentResponses.forEach((resp: any, index: number) => {
            console.log(`Agent Response ${index}:`, {
              agentType: resp.agentType,
              content: resp.content,
              contentType: typeof resp.content,
              contentLength: resp.content?.length,
              hasContent: !!resp.content,
              fullResponse: resp
            });
          });
        }
        
        isOrchestratorComplete = true;
        isLoading = false;
      } else {
        // Trinity data not available yet, use fallback
        finalResponse = typeof message.content === 'string' ? message.content : '';
        isOrchestratorComplete = true;
        isLoading = false;
      }
    } else {
      // Message not found yet, might still be loading
      setTimeout(loadTrinityData, 100);
    }
  }

  onMount(() => {
    loadTrinityData();
    
    // Subscribe to Trinity responses changes
    const unsubscribe = trinityResponses.subscribe(() => {
      loadTrinityData();
    });
    
    return () => {
      unsubscribe();
    };
  });
</script>

<div class="trinity-message {className}">
  {#if error}
    <EnhancedGlass className="error-state" borderRadius={12} padding="16px">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <p>{error}</p>
      </div>
    </EnhancedGlass>
  {:else if isLoading}
    <!-- Initial loading state -->
    <div class="initial-loading">
      <LoadingSpinner size="medium" />
      <p>Loading Trinity response...</p>
    </div>
  {:else}
    <!-- Agent responses -->
    {#if trinityData?.agentResponses && trinityData.agentResponses.length > 0}
      <div class="agents-container">
        {#each trinityData.agentResponses as agentResp}
          {@const agent = agentInfo[agentResp.agentType as keyof typeof agentInfo]}
          {#if agent && agentResp.content}
            <EnhancedGlass 
              className="agent-response {agentResp.agentType}" 
              borderRadius={12} 
              padding="16px"
              elasticity={0}
              blurAmount={16}
              saturation={140}
            >
              <div class="agent-header">
                <span class="agent-icon">{agent.icon}</span>
                <span class="agent-label">{agent.label}</span>
                <span class="complete-icon">✓</span>
              </div>
              
              <div class="agent-content">
                {#if enableMarkdown && agentResp.content}
                  {@html (() => {
                    const parser = createMarkdownParser();
                    parser.setContent(agentResp.content, true);
                    const parsed = parser.getCurrentContent();
                    console.log(`Parsing ${agentResp.agentType} content:`, {
                      original: agentResp.content.substring(0, 100),
                      parsedHtml: parsed.html?.substring(0, 100),
                      hasHtml: !!parsed.html
                    });
                    return parsed.html || agentResp.content;
                  })()}
                {:else}
                  {agentResp.content}
                {/if}
              </div>
            </EnhancedGlass>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- Final orchestrated response -->
    <EnhancedGlass 
      className="final-response" 
      borderRadius={16} 
      padding="20px"
      elasticity={0}
      blurAmount={20}
      saturation={160}
    >
      <div class="final-header">
        <span class="final-icon">✨</span>
        <span class="final-label">Trinity Synthesis</span>
      </div>
      
      <div class="final-content">
        {#if enableMarkdown && finalResponse}
          {@html (() => {
            const parser = createMarkdownParser();
            parser.setContent(finalResponse, true);
            const parsed = parser.getCurrentContent();
            console.log('Parsing final response:', {
              original: finalResponse.substring(0, 100),
              parsedHtml: parsed.html?.substring(0, 100),
              hasHtml: !!parsed.html
            });
            return parsed.html || finalResponse;
          })()}
        {:else}
          {finalResponse}
        {/if}
      </div>

      {#if trinityData?.attribution}
        <div class="attribution">
          {#each Object.entries(trinityData.attribution) as [agent, data]}
            <div class="attribution-item">
              <span class="agent-icon-small">{agentInfo[agent as keyof typeof agentInfo]?.icon || '🤖'}</span>
              <span class="contribution">{Math.round((data as any).contributionPercentage * 100)}%</span>
            </div>
          {/each}
        </div>
      {/if}
    </EnhancedGlass>
  {/if}
</div>

<style>
  .trinity-message {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  /* Agents container */
  .agents-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 12px;
  }

  /* Agent response cards */
  :global(.agent-response) {
    background: linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.1),
      rgba(0, 0, 0, 0.05)
    ) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    transition: transform 0.2s ease;
  }

  :global(.agent-response.analytical) {
    border-color: rgba(59, 130, 246, 0.3) !important;
  }

  :global(.agent-response.creative) {
    border-color: rgba(168, 85, 247, 0.3) !important;
  }

  :global(.agent-response.factual) {
    border-color: rgba(34, 197, 94, 0.3) !important;
  }

  :global(.agent-response:hover) {
    transform: translateY(-2px);
  }

  .agent-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .agent-icon {
    font-size: 20px;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }

  .agent-label {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
  }

  .complete-icon {
    margin-left: auto;
    color: #22c55e;
    font-size: 14px;
  }

  .agent-content {
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.85);
    min-height: 60px;
  }

  .waiting-text {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
    margin: 0;
  }

  .streaming-cursor {
    display: inline-block;
    animation: blink 1s infinite;
    color: #6366f1;
    font-weight: bold;
  }

  /* Final response */
  :global(.final-response) {
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.1),
      rgba(118, 75, 162, 0.1)
    ) !important;
    border: 1px solid rgba(102, 126, 234, 0.2) !important;
    margin-top: 12px;
  }

  .final-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .final-icon {
    font-size: 24px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  .final-label {
    font-weight: 700;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.95);
  }

  .final-content {
    font-size: 15px;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.9);
  }

  .synthesizing {
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
    margin: 0;
    animation: pulse 2s ease-in-out infinite;
  }

  /* Attribution */
  .attribution {
    display: flex;
    gap: 16px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .attribution-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .agent-icon-small {
    font-size: 14px;
  }

  .contribution {
    font-weight: 600;
  }

  /* Loading states */
  .initial-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    text-align: center;
  }

  .initial-loading p {
    margin-top: 16px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }

  /* Error state */
  :global(.error-state) {
    background: rgba(239, 68, 68, 0.1) !important;
    border: 1px solid rgba(239, 68, 68, 0.3) !important;
  }

  .error-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .error-icon {
    font-size: 20px;
  }

  .error-content p {
    flex: 1;
    margin: 0;
    color: rgba(255, 255, 255, 0.9);
  }

  .error-content button {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: white;
    padding: 6px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .error-content button:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  /* Animations */
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .agents-container {
      grid-template-columns: 1fr;
    }

    .attribution {
      justify-content: center;
    }
  }
</style> 