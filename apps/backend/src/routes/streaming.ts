import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createWebSocketHandler, createSSEHandler, streamingUtils } from '../lib/streaming.js';

export const streamingRouter = new Hono();

// CORS for streaming endpoints
streamingRouter.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));

// WebSocket upgrade endpoint
streamingRouter.get('/ws', createWebSocketHandler());

// Server-Sent Events endpoint  
streamingRouter.get('/sse', createSSEHandler());

// Streaming statistics endpoint (for debugging)
streamingRouter.get('/stats', (c) => {
  const stats = streamingUtils.getStats();
  return c.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString(),
  });
});

// Health check for streaming service
streamingRouter.get('/ping', (c) => {
  return c.json({
    success: true,
    message: 'Streaming service is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Broadcast message endpoint (for testing)
streamingRouter.post('/broadcast', async (c) => {
  try {
    const body = await c.req.json();
    const { type, data, excludeUserId } = body;

    if (!type) {
      return c.json({ error: 'Message type is required' }, 400);
    }

    const message = {
      type,
      id: `broadcast_${Date.now()}`,
      data: data || {},
      timestamp: Date.now(),
    };

    streamingUtils.broadcast(message, excludeUserId);

    return c.json({
      success: true,
      message: 'Message broadcasted',
      data: message,
    });
  } catch (error) {
    console.error('Broadcast error:', error);
    return c.json({ error: 'Failed to broadcast message' }, 500);
  }
});

// Send message to specific user endpoint
streamingRouter.post('/send/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { type, data } = body;

    if (!type) {
      return c.json({ error: 'Message type is required' }, 400);
    }

    const message = {
      type,
      id: `direct_${Date.now()}`,
      userId,
      data: data || {},
      timestamp: Date.now(),
    };

    streamingUtils.sendToUser(userId, message);

    return c.json({
      success: true,
      message: `Message sent to user ${userId}`,
      data: message,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return c.json({ error: 'Failed to send message' }, 500);
  }
});

// LLM Response streaming endpoint (for chat responses)
streamingRouter.post('/chat-stream', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, threadId, messageId, content, model, provider } = body;

    if (!userId || !threadId || !messageId) {
      return c.json({ error: 'userId, threadId, and messageId are required' }, 400);
    }

    // Simulate streaming LLM response
    const words = content?.split(' ') || ['Streaming', 'response', 'from', 'LLM'];
    let accumulatedContent = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      accumulatedContent += (i > 0 ? ' ' : '') + word;
      
      const streamMessage = {
        type: 'chat_response' as const,
        id: `stream_${messageId}_${i}`,
        threadId,
        userId,
        data: {
          messageId,
          content: accumulatedContent,
          role: 'assistant' as const,
          model,
          provider,
          isComplete: i === words.length - 1,
          delta: word,
        },
        timestamp: Date.now(),
      };

      // Send to the specific user and thread participants
      streamingUtils.sendToUser(userId, streamMessage);
      streamingUtils.sendToThread(threadId, streamMessage);

      // Add delay to simulate real streaming
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send completion message
    const completionMessage = {
      type: 'chat_complete' as const,
      id: `complete_${messageId}`,
      threadId,
      userId,
      data: {
        messageId,
        content: accumulatedContent,
        role: 'assistant' as const,
        model,
        provider,
        isComplete: true,
      },
      timestamp: Date.now(),
    };

    streamingUtils.sendToUser(userId, completionMessage);
    streamingUtils.sendToThread(threadId, completionMessage);

    return c.json({
      success: true,
      message: 'Streaming completed',
      data: {
        messageId,
        content: accumulatedContent,
        wordCount: words.length,
      },
    });
  } catch (error) {
    console.error('Chat stream error:', error);
    return c.json({ error: 'Failed to stream chat response' }, 500);
  }
}); 