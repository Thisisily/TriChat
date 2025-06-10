import { router } from './init.js';
import { healthRouter } from '../routes/health.js';
import { chatRouter } from '../routes/chat.js';

// Main app router combining all sub-routers
export const appRouter = router({
  health: healthRouter,
  chat: chatRouter,
});

// Export the router type for use in frontend
export type AppRouter = typeof appRouter; 