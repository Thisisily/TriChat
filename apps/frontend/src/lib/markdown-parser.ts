import { marked } from 'marked';
import { writable, derived, type Writable } from 'svelte/store';

// Configure marked for optimal streaming performance
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false,
  silent: true,
});

// Types for incremental parsing
export interface ParsedContent {
  html: string;
  text: string;
  isComplete: boolean;
  lastParsedIndex: number;
  timestamp: number;
}

export interface MarkdownChunk {
  content: string;
  startIndex: number;
  endIndex: number;
  isCodeBlock?: boolean;
  isTable?: boolean;
  isList?: boolean;
}

// Cache for parsed content to avoid re-parsing
class MarkdownCache {
  private cache = new Map<string, ParsedContent>();
  private maxCacheSize = 100;

  get(key: string): ParsedContent | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: ParsedContent): void {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
}

// Incremental markdown parser class
export class IncrementalMarkdownParser {
  private cache = new MarkdownCache();
  private pendingContent = '';
  private lastParsedContent = '';
  private parseQueue: string[] = [];
  private isProcessing = false;
  private parseThrottle = 16; // 60fps for smooth updates
  private lastParseTime = 0;

  // Reactive stores
  private contentStore: Writable<ParsedContent> = writable({
    html: '',
    text: '',
    isComplete: false,
    lastParsedIndex: 0,
    timestamp: Date.now()
  });

  public readonly content = this.contentStore;
  public readonly html = derived(this.contentStore, $content => $content.html);
  public readonly isComplete = derived(this.contentStore, $content => $content.isComplete);

  // Add new content chunk for parsing
  appendContent(newContent: string): void {
    this.pendingContent += newContent;
    this.queueParse();
  }

  // Set complete content (final parse)
  setContent(content: string, isComplete = true): void {
    this.pendingContent = content;
    this.parseImmediate(isComplete);
  }

  // Reset parser state
  reset(): void {
    this.pendingContent = '';
    this.lastParsedContent = '';
    this.parseQueue = [];
    this.isProcessing = false;
    this.contentStore.set({
      html: '',
      text: '',
      isComplete: false,
      lastParsedIndex: 0,
      timestamp: Date.now()
    });
  }

  // Get current content state
  getCurrentContent(): ParsedContent {
    let content: ParsedContent;
    this.contentStore.subscribe(c => content = c)();
    return content!;
  }

  // Queue parsing with throttling
  private queueParse(): void {
    const now = Date.now();
    
    if (now - this.lastParseTime < this.parseThrottle) {
      // Throttle parsing for performance
      setTimeout(() => this.queueParse(), this.parseThrottle);
      return;
    }

    this.parseQueue.push(this.pendingContent);
    this.processQueue();
  }

  // Process parsing queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.parseQueue.length === 0) return;

    this.isProcessing = true;
    const contentToParse = this.parseQueue.pop(); // Get latest
    this.parseQueue = []; // Clear queue to avoid duplicate work

    if (contentToParse) {
      await this.parseContent(contentToParse, false);
    }

    this.isProcessing = false;
    this.lastParseTime = Date.now();

    // Process any queued items
    if (this.parseQueue.length > 0) {
      setTimeout(() => this.processQueue(), 0);
    }
  }

  // Parse immediately (for final content)
  private async parseImmediate(isComplete = false): Promise<void> {
    await this.parseContent(this.pendingContent, isComplete);
  }

  // Core parsing logic with incremental optimization
  private async parseContent(content: string, isComplete: boolean): Promise<void> {
    if (!content) return;

    try {
      // Check cache first
      const cacheKey = `${content.length}:${content.slice(-50)}`; // Length + last 50 chars
      const cached = this.cache.get(cacheKey);

      if (cached && !isComplete) {
        this.contentStore.set({
          ...cached,
          isComplete
        });
        return;
      }

      // Detect if we need special handling for incomplete structures
      const needsSpecialHandling = this.detectIncompleteStructures(content);
      let contentToParse = content;

      if (needsSpecialHandling && !isComplete) {
        // For incomplete content, parse up to safe point
        contentToParse = this.getSafeParsingPoint(content);
      }

      // Parse markdown
      const html = await this.parseMarkdown(contentToParse);
      const text = this.extractPlainText(contentToParse);

      const parsed: ParsedContent = {
        html,
        text,
        isComplete,
        lastParsedIndex: contentToParse.length,
        timestamp: Date.now()
      };

      // Cache the result
      if (contentToParse.length > 50) {
        this.cache.set(cacheKey, parsed);
      }

      // Update store
      this.contentStore.set(parsed);
      this.lastParsedContent = contentToParse;

    } catch (error) {
      console.error('Markdown parsing error:', error);
      
      // Fallback to plain text
      this.contentStore.set({
        html: this.escapeHtml(content),
        text: content,
        isComplete,
        lastParsedIndex: content.length,
        timestamp: Date.now()
      });
    }
  }

  // Parse markdown with error handling
  private async parseMarkdown(content: string): Promise<string> {
    return new Promise((resolve) => {
      try {
        // Use marked with streaming-friendly options
        const html = marked.parse(content, {
          async: false,
          breaks: true,
          gfm: true,
        }) as string;
        
        resolve(html);
      } catch (error) {
        console.warn('Markdown parsing failed, using fallback:', error);
        resolve(this.escapeHtml(content));
      }
    });
  }

  // Detect incomplete markdown structures
  private detectIncompleteStructures(content: string): boolean {
    // Check for incomplete code blocks
    const codeBlockMatches = content.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
      return true;
    }

    // Check for incomplete tables
    const lines = content.split('\n');
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 3); i--) {
      const line = lines[i];
      if (line.includes('|') && !line.trim().endsWith('|')) {
        return true;
      }
    }

    // Check for incomplete lists (ending with incomplete item)
    const lastLine = lines[lines.length - 1];
    if (lastLine && /^[\s]*[-*+]\s*$/.test(lastLine)) {
      return true;
    }

    return false;
  }

  // Find safe parsing point for incomplete content
  private getSafeParsingPoint(content: string): string {
    const lines = content.split('\n');
    
    // Find last complete line that's safe to parse
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Check if this line completes a structure
      if (this.isCompleteLine(line, lines.slice(0, i))) {
        return lines.slice(0, i + 1).join('\n');
      }
    }

    // Fallback to full content
    return content;
  }

  // Check if a line completes a markdown structure
  private isCompleteLine(line: string, previousLines: string[]): boolean {
    // Complete sentences end with punctuation
    if (/[.!?]\s*$/.test(line.trim())) {
      return true;
    }

    // Complete list items
    if (/^[\s]*[-*+]\s+.+[.!?]\s*$/.test(line)) {
      return true;
    }

    // Complete table rows
    if (line.includes('|') && line.trim().endsWith('|')) {
      return true;
    }

    // Complete headers
    if (/^#{1,6}\s+.+$/.test(line)) {
      return true;
    }

    // Not in the middle of a code block
    const codeBlocksBefore = previousLines.join('\n').match(/```/g) || [];
    if (codeBlocksBefore.length % 2 === 0) {
      return true;
    }

    return false;
  }

  // Extract plain text from markdown
  private extractPlainText(content: string): string {
    return content
      .replace(/```[\s\S]*?```/g, '[code block]')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '• ')
      .replace(/^\s*\d+\.\s+/gm, '1. ')
      .trim();
  }

  // Escape HTML for fallback
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Chunk content for efficient processing
  chunkContent(content: string): MarkdownChunk[] {
    const chunks: MarkdownChunk[] = [];
    const lines = content.split('\n');
    let currentChunk = '';
    let startIndex = 0;
    let currentIndex = 0;
    let inCodeBlock = false;
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk += (i > 0 ? '\n' : '') + line;

      // Track code blocks
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
      }

      // Track tables
      if (line.includes('|') && !inCodeBlock) {
        inTable = true;
      } else if (inTable && !line.includes('|') && line.trim()) {
        inTable = false;
      }

      // Create chunk at natural boundaries
      if (this.isChunkBoundary(line, inCodeBlock, inTable) || i === lines.length - 1) {
        chunks.push({
          content: currentChunk,
          startIndex,
          endIndex: currentIndex + line.length,
          isCodeBlock: inCodeBlock,
          isTable: inTable,
        });

        startIndex = currentIndex + line.length + 1;
        currentChunk = '';
      }

      currentIndex += line.length + 1; // +1 for newline
    }

    return chunks;
  }

  // Determine chunk boundaries
  private isChunkBoundary(line: string, inCodeBlock: boolean, inTable: boolean): boolean {
    if (inCodeBlock || inTable) return false;

    // End sentences
    if (/[.!?]\s*$/.test(line.trim())) return true;

    // Headers
    if (/^#{1,6}\s/.test(line)) return true;

    // Empty lines
    if (!line.trim()) return true;

    return false;
  }
}

// Factory function for creating parser instances
export const createMarkdownParser = (): IncrementalMarkdownParser => {
  return new IncrementalMarkdownParser();
};

// Utility functions for markdown detection and formatting
export const markdownUtils = {
  // Detect if content contains markdown
  hasMarkdown: (content: string): boolean => {
    const markdownPatterns = [
      /#{1,6}\s/, // Headers
      /\*\*.*\*\*/, // Bold
      /\*.*\*/, // Italic
      /`.*`/, // Inline code
      /```/, // Code blocks
      /\[.*\]\(.*\)/, // Links
      /^\s*[-*+]\s/m, // Lists
      /^\s*\d+\.\s/m, // Numbered lists
      /\|.*\|/, // Tables
    ];

    return markdownPatterns.some(pattern => pattern.test(content));
  },

  // Clean markdown for plain text display
  stripMarkdown: (content: string): string => {
    return content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .trim();
  },

  // Get markdown statistics
  getStats: (content: string) => {
    const lines = content.split('\n');
    const words = content.trim().split(/\s+/).length;
    const chars = content.length;
    const headers = (content.match(/^#{1,6}\s/gm) || []).length;
    const codeBlocks = (content.match(/```/g) || []).length / 2;
    const links = (content.match(/\[.*\]\(.*\)/g) || []).length;

    return {
      lines: lines.length,
      words,
      characters: chars,
      headers,
      codeBlocks: Math.floor(codeBlocks),
      links
    };
  }
}; 