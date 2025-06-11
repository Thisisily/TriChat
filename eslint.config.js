import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      ...ts.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  // Backend (Node.js/Bun) configuration
  {
    files: ['apps/backend/**/*.{js,ts}', 'packages/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        // Node.js/Bun globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        
        // Bun specific
        Bun: 'readonly',
        
        // Web Standards available in Bun
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        WebSocket: 'readonly',
        ReadableStream: 'readonly',
        WritableStream: 'readonly',
        TransformStream: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        
        // Timers
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        
        // Crypto
        crypto: 'readonly',
        
        // AbortController
        AbortController: 'readonly',
        AbortSignal: 'readonly',
      },
    },
  },
  // Frontend (Browser) configuration
  {
    files: ['apps/frontend/**/*.{js,ts}', '**/*.svelte'],
    languageOptions: {
      globals: {
        // Browser APIs
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        
        // Web APIs
        WebSocket: 'readonly',
        EventSource: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        
        // DOM APIs
        HTMLElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        ShadowRoot: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        
        // Timers and async
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        queueMicrotask: 'readonly',
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly',
        
        // Workers and encoding
        Worker: 'readonly',
        Blob: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        
        // Web platform
        CSS: 'readonly',
        AbortController: 'readonly',
        DOMException: 'readonly',
      },
    },
  },
  // Svelte specific configuration
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.svelte'],
      },
    },
    plugins: {
      svelte,
    },
    rules: {
      ...svelte.configs.recommended.rules,
      'svelte/no-unused-svelte-ignore': 'error',
      'svelte/no-at-html-tags': 'error',
    },
  },
  {
    ignores: [
      // Dependencies
      'node_modules/',
      '**/node_modules/',
      
      // Build outputs
      'dist/',
      '**/dist/',
      'build/',
      '**/build/',
      '.svelte-kit/',
      '**/.svelte-kit/',
      
      // Generated files
      'coverage/',
      '**/coverage/',
      '**/*.d.ts',
      'generated/',
      '**/generated/',
      
      // Prisma generated
      'apps/backend/prisma/migrations/',
      'apps/backend/generated/',
      
      // Package manager
      '.pnpm/',
      '.yarn/',
      'yarn.lock',
      'package-lock.json',
      'bun.lockb',
      
      // IDE/OS files
      '.DS_Store',
      '*.log',
      '.env',
      '.env.*',
      
      // Temporary files
      '*.tmp',
      '*.temp',
      
      // Large bundled files (often unreadable anyway)
      '**/*bundle*.js',
      '**/*chunk*.js',
      '**/*vendor*.js',
    ],
  },
];
 