/**
 * Actor Mock Configuration and Utilities
 * 
 * This module provides interfaces and utilities for creating mock actors
 * in E2E tests, allowing for customizable actor counts, names, and spawn preferences.
 */

/**
 * Configuration for a mock actor
 */
export interface MockActor {
  uid: string;
  username: string;
  roleColor: string;
  presence?: string;
  preferredSpawnArea?: {
    x: number;
    y: number;
    radius?: number; // Optional radius for spawn area preference
  };
}

/**
 * Configuration for mock server with configurable actors
 */
export interface MockServerConfig {
  serverId?: string;
  serverName?: string;
  actors: MockActor[];
}

/**
 * Generate default mock actors with sequential naming
 * 
 * @param count Number of actors to generate
 * @returns Array of mock actors with sequential names (MockActor1, MockActor2, etc.)
 * 
 * @example
 * ```typescript
 * const actors = generateDefaultMockActors(5);
 * // Returns: [{ uid: 'mock-user-1', username: 'MockActor1', ... }, ...]
 * ```
 */
export function generateDefaultMockActors(count: number): MockActor[] {
  const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#33FFF5', '#F5FF33', '#FF8333', '#8333FF', '#33FF83', '#F533FF'];
  
  return Array.from({ length: count }, (_, i) => ({
    uid: `mock-user-${i + 1}`,
    username: `MockActor${i + 1}`,
    roleColor: colors[i % colors.length],
    presence: 'online'
  }));
}

/**
 * Generate mock actors with custom usernames
 * 
 * @param usernames Array of custom usernames to use
 * @returns Array of mock actors with the specified usernames
 * 
 * @example
 * ```typescript
 * const actors = generateCustomMockActors(['Alice', 'Bob', 'Charlie']);
 * // Returns: [{ uid: 'mock-user-1', username: 'Alice', ... }, ...]
 * ```
 */
export function generateCustomMockActors(usernames: string[]): MockActor[] {
  const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#33FFF5', '#F5FF33', '#FF8333', '#8333FF', '#33FF83', '#F533FF'];
  
  return usernames.map((username, i) => ({
    uid: `mock-user-${i + 1}`,
    username: username,
    roleColor: colors[i % colors.length],
    presence: 'online'
  }));
}