import { router } from './init.js';
import { healthRouter } from '../routes/health.js';
import { chatRouter } from '../routes/chat.js';
import { authRouter } from '../routes/auth.js';
import { memoryCardsRouter } from '../routes/memory-cards.js';
import { conflictResolutionRouter } from '../routes/conflict-resolution.js';
import { trinityRouter } from '../routes/trinity.js';

// Main app router combining all sub-routers
export const appRouter = router({
  health: healthRouter,
  chat: chatRouter,
  auth: authRouter,
  memoryCards: memoryCardsRouter,
  conflictResolution: conflictResolutionRouter,
  trinity: trinityRouter,
});

// Export the router type for use in frontend
export type AppRouter = typeof appRouter; 