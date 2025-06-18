/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env['VITEST'] })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.svelte-kit'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        '.svelte-kit/'
      ]
    },
    // Mock CSS imports
    css: true,
    // Handle static assets
    server: {
      deps: {
        inline: ['@testing-library/svelte']
      }
    }
  },
  resolve: {
    alias: {
      '$lib': new URL('./src/lib', import.meta.url).pathname,
      '$app': new URL('./src/app', import.meta.url).pathname
    }
  }
}); 