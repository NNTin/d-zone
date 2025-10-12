/**
 * Test utilities and helper functions
 */

import { expect } from 'vitest';

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
 * Custom test assertions for game-specific unit testing
 */
export class GameTestAssertions {
  /**
   * Assert that an actor object has the expected properties
   */
  static assertActorValid(actor: any, expectedName?: string) {
    expect(actor).toBeDefined();
    expect(actor).toHaveProperty('uid');
    expect(actor).toHaveProperty('username');
    expect(actor).toHaveProperty('x');
    expect(actor).toHaveProperty('y');
    expect(actor).toHaveProperty('z');
    
    if (expectedName) {
      expect(actor.username).toBe(expectedName);
    }
  }

  /**
   * Assert that coordinates are within expected bounds
   */
  static assertCoordinatesValid(x: number, y: number, z: number, bounds?: { minX?: number, maxX?: number, minY?: number, maxY?: number, minZ?: number, maxZ?: number }) {
    expect(typeof x).toBe('number');
    expect(typeof y).toBe('number');
    expect(typeof z).toBe('number');
    
    if (bounds) {
      if (bounds.minX !== undefined) expect(x).toBeGreaterThanOrEqual(bounds.minX);
      if (bounds.maxX !== undefined) expect(x).toBeLessThanOrEqual(bounds.maxX);
      if (bounds.minY !== undefined) expect(y).toBeGreaterThanOrEqual(bounds.minY);
      if (bounds.maxY !== undefined) expect(y).toBeLessThanOrEqual(bounds.maxY);
      if (bounds.minZ !== undefined) expect(z).toBeGreaterThanOrEqual(bounds.minZ);
      if (bounds.maxZ !== undefined) expect(z).toBeLessThanOrEqual(bounds.maxZ);
    }
  }

  /**
   * Assert that a game state object is valid
   */
  static assertGameStateValid(gameState: any) {
    expect(gameState).toBeDefined();
    expect(gameState).toHaveProperty('initialized');
    expect(typeof gameState.initialized).toBe('boolean');
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
 * Performance testing utilities for unit tests
 */
export class PerformanceUtils {
  /**
   * Measure execution time of a function
   */
  static async measureExecutionTime(fn: () => Promise<void> | void): Promise<number> {
    const start = Date.now();
    await fn();
    const end = Date.now();
    return end - start;
  }

  /**
   * Create a performance benchmark for repeated operations
   */
  static async benchmark(fn: () => Promise<void> | void, iterations = 100): Promise<{ averageTime: number, totalTime: number, iterations: number }> {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const time = await this.measureExecutionTime(fn);
      times.push(time);
    }
    
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    
    return {
      averageTime,
      totalTime,
      iterations
    };
  }

  /**
   * Assert that an operation completes within a time limit
   */
  static async assertPerformance(fn: () => Promise<void> | void, maxTimeMs: number): Promise<void> {
    const time = await this.measureExecutionTime(fn);
    expect(time).toBeLessThanOrEqual(maxTimeMs);
  }
}