import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.{ts,js}',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['allure-playwright', { 
      outputFolder: 'allure-results',
      detail: true,
      environmentInfo: {
        framework: 'Playwright',
        language: 'TypeScript',
        shard: process.env.ALLURE_SHARD_ID || 'unknown',
        totalShards: process.env.ALLURE_TOTAL_SHARDS || 'unknown',
        testType: process.env.ALLURE_TEST_TYPE || 'E2E'
      }
    }],
    ['json', { 
      outputFile: process.env.ALLURE_SHARD_ID 
        ? `test-results/results-shard-${process.env.ALLURE_SHARD_ID}.json`
        : 'test-results/results.json' 
    }]
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://127.0.0.1:8080',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Screenshot settings */
    screenshot: 'only-on-failure',
    
    /* Video settings */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grep: /@critical|@normal|@active/,
      grepInvert: /@inactive/,
    },
    
    // CI project for sharded execution
    // Only run this project in CI environment
    ...(process.env.CI ? [{
      name: process.env.ALLURE_SHARD_ID ? `ci-shard-${process.env.ALLURE_SHARD_ID}` : 'ci',
      use: { ...devices['Desktop Chrome'] },
      grep: /@critical|@normal|@long|@active/,
      grepInvert: /@inactive/,
    }] : []),
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});