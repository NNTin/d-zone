/**
 * Test utilities and helper functions
 */

import { expect } from '@playwright/test';

/**
 * Mock localStorage implementation for unit tests
 * Provides a complete localStorage-compatible interface for testing
 * without relying on browser APIs.
 */
export class MockLocalStorage implements Storage {
  private storage: Record<string, string> = {};

  /**
   * Get an item from storage
   */
  getItem(key: string): string | null {
    return this.storage[key] || null;
  }

  /**
   * Set an item in storage
   */
  setItem(key: string, value: string): void {
    this.storage[key] = value;
  }

  /**
   * Remove an item from storage
   */
  removeItem(key: string): void {
    delete this.storage[key];
  }

  /**
   * Clear all items from storage
   */
  clear(): void {
    this.storage = {};
  }

  /**
   * Get the number of items in storage
   */
  get length(): number {
    return Object.keys(this.storage).length;
  }

  /**
   * Get the key at the specified index
   */
  key(index: number): string | null {
    const keys = Object.keys(this.storage);
    return keys[index] || null;
  }
}

/**
 * Custom test assertions for game-specific testing
 */
export class GameTestAssertions {
  /**
   * Assert that an actor is visible on the game canvas
   */
  static async assertActorVisible(page: any, actorName: string) {
    const actor = page.locator(`[data-testid="actor-${actorName}"]`);
    await expect(actor).toBeVisible();
  }

  /**
   * Assert that a nametag is displayed
   */
  static async assertNametagVisible(page: any, username: string) {
    const nametag = page.locator(`[data-testid="nametag-${username}"]`);
    await expect(nametag).toBeVisible();
  }

  /**
   * Assert that movement animation is playing
   */
  static async assertMovementAnimation(page: any, actorName: string) {
    const actor = page.locator(`[data-testid="actor-${actorName}"]`);
    await expect(actor).toHaveClass(/moving/);
  }

  /**
   * Wait for game to be fully loaded
   */
  static async waitForGameLoad(page: any) {
    await page.waitForSelector('[data-testid="game-canvas"]');
    await page.waitForFunction(() => window.gameLoaded === true);
  }
}

/**
 * Test data builders for creating test scenarios
 */
export class TestDataBuilder {
  static createActor(overrides = {}) {
    return {
      uid: `actor-${Date.now()}`,
      username: 'testactor',
      x: 0,
      y: 0,
      z: 0,
      roleColor: '#FF5733',
      presence: 'online',
      ...overrides,
    };
  }

  static createMessage(overrides = {}) {
    return {
      id: `msg-${Date.now()}`,
      content: 'Test message',
      channel: 'general',
      timestamp: Date.now(),
      ...overrides,
    };
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceUtils {
  static async measureLoadTime(page: any) {
    const start = Date.now();
    await GameTestAssertions.waitForGameLoad(page);
    const end = Date.now();
    return end - start;
  }

  static async measureFrameRate(page: any, duration = 5000) {
    return await page.evaluate((duration) => {
      return new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        
        function countFrame() {
          frames++;
          if (performance.now() - start < duration) {
            requestAnimationFrame(countFrame);
          } else {
            resolve(frames / (duration / 1000));
          }
        }
        
        requestAnimationFrame(countFrame);
      });
    }, duration);
  }
}