/**
 * Vitest setup file
 * Runs before all test files
 */

import { beforeAll, beforeEach, vi } from 'vitest';
import { setupGlobalMocks } from './unit/mocks/browserMocks';

// Setup global mocks for all tests
beforeAll(() => {
  setupGlobalMocks();
});

// Reset mocks between tests
beforeEach(() => {
  // Clear any module mocks between tests
  vi.clearAllMocks();
});