/**
 * Vitest setup file
 * Runs before all test files
 */

import { beforeAll, beforeEach } from 'vitest';
import { setupGlobalMocks } from './mocks/browserMocks';

// Setup global mocks for all tests
beforeAll(() => {
  setupGlobalMocks();
});

// Reset mocks between tests
beforeEach(() => {
  // Clear any module mocks between tests
  if (typeof vi !== 'undefined') {
    vi.clearAllMocks();
  }
});