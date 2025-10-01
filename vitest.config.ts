import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /* Test file patterns */
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['tests/**/*.e2e.{js,ts}'],
    
    /* Global test setup */
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    
    /* Coverage settings */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
      ],
    },
    
    /* Reporter configuration */
    reporter: [
      'default',
      'json',
      'allure-vitest/reporter'
    ],
    
    /* Test filtering by tags */
    testNamePattern: process.env.CI 
      ? '(@critical|@normal|@long|@active)(?!.*@inactive)'
      : '(@critical|@normal|@active)(?!.*@inactive|.*@long)',
    
    /* Parallel execution */
    maxConcurrency: 4,
    
    /* Timeout settings */
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});