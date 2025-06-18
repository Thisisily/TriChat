import { prisma } from './database';

/**
 * Interface for thread history query options
 */
export interface ThreadHistoryOptions {
  userId: string;
  limit?: number;
  cursor?: string;
  includeBranches?: boolean;
  since?: Date;
}

/**
 * Interface for thread history results
 */
export interface ThreadHistoryResult {
  threads: ThreadWithPreview[];
  nextCursor?: string | undefined;
  hasMore: boolean;
  totalCount?: number | undefined;
}

/**
 * Interface for thread with message preview
 */
export interface ThreadWithPreview {
  id: string;
  title: string;
  isPublic: boolean;
  parentThreadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: {
    id: string;
    content: string;
    role: string;
    createdAt: Date;
  } | undefined;
  messageCount: number;
  branches?: ThreadWithPreview[];
}

/**
 * Interface for sync-specific thread data
 */
export interface SyncThreadData {
  id: string;
  title: string;
  isPublic: boolean;
  parentThreadId: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessageAt?: Date;
}

/**
 * Get thread history for a user with pagination and message previews
 * @param options - Query options including user ID, pagination, and filters
 * @returns Promise<ThreadHistoryResult> - Paginated thread history
 */
export async function getThreadHistory(options: ThreadHistoryOptions): Promise<ThreadHistoryResult> {
  const {
    userId,
    limit = 20,
    cursor,
    includeBranches = false,
    since
  } = options;

  // Build where conditions
  const whereConditions: any = {
    userId,
  };

  // Add cursor-based pagination
  if (cursor) {
    whereConditions.id = {
      lt: cursor
    };
  }

  // Add since filter for synchronization
  if (since) {
    whereConditions.updatedAt = {
      gte: since
    };
  }

  // Only include top-level threads unless branches are requested
  if (!includeBranches) {
    whereConditions.parentThreadId = null;
  }

  // Query threads with message previews
  const threads = await prisma.thread.findMany({
    where: whereConditions,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          content: true,
          role: true,
          createdAt: true,
        }
      },
      _count: {
        select: { messages: true }
      },
      ...(includeBranches && {
        branches: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                content: true,
                role: true,
                createdAt: true,
              }
            },
            _count: {
              select: { messages: true }
            }
          }
        }
      })
    },
    orderBy: { updatedAt: 'desc' },
    take: limit + 1, // Take one extra to check if there are more
  });

  // Check if there are more results
  const hasMore = threads.length > limit;
  const resultThreads = hasMore ? threads.slice(0, limit) : threads;

  // Get next cursor
  const nextCursor = hasMore ? resultThreads[resultThreads.length - 1].id : undefined;

  // Transform threads to include preview data
  const threadsWithPreview: ThreadWithPreview[] = resultThreads.map(thread => ({
    id: thread.id,
    title: thread.title,
    isPublic: thread.isPublic,
    parentThreadId: thread.parentThreadId,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    lastMessage: thread.messages[0] ? {
      id: thread.messages[0].id,
      content: thread.messages[0].content,
      role: thread.messages[0].role,
      createdAt: thread.messages[0].createdAt,
    } : undefined,
    messageCount: thread._count.messages,
    ...(includeBranches && thread.branches && {
      branches: thread.branches.map(branch => ({
        id: branch.id,
        title: branch.title,
        isPublic: branch.isPublic,
        parentThreadId: branch.parentThreadId,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
        lastMessage: branch.messages[0] ? {
          id: branch.messages[0].id,
          content: branch.messages[0].content,
          role: branch.messages[0].role,
          createdAt: branch.messages[0].createdAt,
        } : undefined,
        messageCount: branch._count.messages,
      }))
    })
  }));

  return {
    threads: threadsWithPreview,
    nextCursor,
    hasMore,
  };
}

/**
 * Get threads that have been updated since a specific timestamp
 * @param userId - User ID
 * @param since - Timestamp to check for updates since
 * @returns Promise<SyncThreadData[]> - Array of updated threads
 */
export async function getUpdatedThreadsSince(userId: string, since: Date): Promise<SyncThreadData[]> {
  const threads = await prisma.thread.findMany({
    where: {
      userId,
      updatedAt: {
        gte: since
      }
    },
    include: {
      _count: {
        select: { messages: true }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return threads.map(thread => ({
    id: thread.id,
    title: thread.title,
    isPublic: thread.isPublic,
    parentThreadId: thread.parentThreadId,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messageCount: thread._count.messages,
    lastMessageAt: thread.messages[0]?.createdAt
  }));
}

/**
 * Get a specific thread with all messages for detailed view
 * @param threadId - Thread ID
 * @param userId - User ID (for security)
 * @param messageLimit - Maximum number of messages to return
 * @param messageCursor - Cursor for message pagination
 * @returns Promise<ThreadWithMessages | null> - Thread with messages or null if not found
 */
export async function getThreadWithMessages(
  threadId: string,
  userId: string,
  messageLimit = 50,
  messageCursor?: string
) {
  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      userId // Ensure user owns the thread
    },
    include: {
      messages: {
        where: messageCursor ? {
          id: { lt: messageCursor }
        } : undefined,
        orderBy: { createdAt: 'desc' },
        take: messageLimit + 1, // Take one extra to check for more
      },
      _count: {
        select: { messages: true }
      }
    }
  });

  if (!thread) return null;

  const hasMoreMessages = thread.messages.length > messageLimit;
  const messages = hasMoreMessages ? thread.messages.slice(0, messageLimit) : thread.messages;
  const nextMessageCursor = hasMoreMessages ? messages[messages.length - 1].id : undefined;

  return {
    ...thread,
    messages: messages.reverse(), // Reverse to show oldest first
    hasMoreMessages,
    nextMessageCursor
  };
}

/**
 * Search threads by title or content
 * @param userId - User ID
 * @param query - Search query
 * @param limit - Maximum number of results
 * @returns Promise<ThreadWithPreview[]> - Search results
 */
export async function searchThreads(
  userId: string,
  query: string,
  limit = 10
): Promise<ThreadWithPreview[]> {
  const threads = await prisma.thread.findMany({
    where: {
      userId,
      OR: [
        {
          title: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          messages: {
            some: {
              content: {
                contains: query,
                mode: 'insensitive'
              }
            }
          }
        }
      ]
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          content: true,
          role: true,
          createdAt: true,
        }
      },
      _count: {
        select: { messages: true }
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: limit
  });

  return threads.map(thread => ({
    id: thread.id,
    title: thread.title,
    isPublic: thread.isPublic,
    parentThreadId: thread.parentThreadId,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    lastMessage: thread.messages[0] ? {
      id: thread.messages[0].id,
      content: thread.messages[0].content,
      role: thread.messages[0].role,
      createdAt: thread.messages[0].createdAt,
    } : undefined,
    messageCount: thread._count.messages,
  }));
}

/**
 * Get thread statistics for a user
 * @param userId - User ID
 * @returns Promise<ThreadStats> - Thread statistics
 */
export async function getThreadStats(userId: string) {
  const [totalThreads, totalMessages, recentActivity] = await Promise.all([
    prisma.thread.count({ where: { userId } }),
    prisma.message.count({ where: { userId } }),
    prisma.thread.findMany({
      where: {
        userId,
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      select: { id: true }
    })
  ]);

  return {
    totalThreads,
    totalMessages,
    recentActiveThreads: recentActivity.length,
    averageMessagesPerThread: totalThreads > 0 ? Math.round(totalMessages / totalThreads) : 0
  };
}

/**
 * Update user's last sync timestamp
 * @param userId - User ID
 * @returns Promise<void>
 */
export async function updateUserLastSync(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastSyncedAt: new Date() }
  });
}

/**
 * Get user's last sync timestamp
 * @param userId - User ID
 * @returns Promise<Date | null> - Last sync timestamp or null if never synced
 */
export async function getUserLastSync(userId: string): Promise<Date | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastSyncedAt: true }
  });

  return user?.lastSyncedAt || null;
} 