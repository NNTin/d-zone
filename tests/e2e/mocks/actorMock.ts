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
 * Configuration for a specific actor position override
 */
export interface MockActorPosition {
  uid: string;
  x: number;
  y: number;
  z?: number;
}

/**
 * Configuration for actor positioning in tests
 */
export interface MockActorPositioning {
  /** Override specific actor positions */
  fixedPositions?: MockActorPosition[];
  /** Custom positions to cycle through for any unspecified actors */
  customSpawnPoints?: { x: number; y: number; z?: number }[];
  /** Whether to use random positioning for actors without fixed positions */
  useRandomForUnspecified?: boolean;
}

/**
 * Configuration for mock server with configurable actors
 */
export interface MockServerConfig {
  serverId?: string;
  serverName?: string;
  actors: MockActor[];
  /** Optional positioning configuration for actors */
  positioning?: MockActorPositioning;
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

/**
 * Creates a mock script for actor positioning that overrides the Users.addActor method
 * 
 * This mock allows precise control over where actors spawn, either through fixed positions
 * for specific actors or custom spawn points that cycle through for unspecified actors.
 * 
 * @returns Function to be used with page.addInitScript()
 * 
 * @example
 * ```typescript
 * const positioning = {
 *   fixedPositions: [
 *     { uid: 'mock-user-1', x: 5, y: 3, z: 0 },
 *     { uid: 'mock-user-2', x: -2, y: 7, z: 0 }
 *   ],
 *   customSpawnPoints: [
 *     { x: 0, y: 0, z: 0 },
 *     { x: 1, y: 1, z: 0 },
 *     { x: 2, y: 2, z: 0 }
 *   ],
 *   useRandomForUnspecified: false
 * };
 * await page.addInitScript(getMockActorPositioningScript(), positioning);
 * ```
 */
export function getMockActorPositioningScript() {
  return (config: MockActorPositioning) => {
    console.log('🎯 [INIT SCRIPT] Setting up actor positioning mock');
    console.log('🎯 [POSITIONING] Configuration:', config);
    
    // Store the positioning configuration globally
    (window as any).__mockActorPositioning = {
      enabled: true,
      config: config,
      spawnIndex: 0 // Track which custom spawn point to use next
    };
    
    // Function to set up the positioning mock
    const setupPositioningMock = () => {
      // We need to patch the World.randomEmptyGrid method instead of Users.addActor
      // because the Users class may not be directly accessible
      
      // Wait for the world to be available
      if (!(window as any).__WorldClass) {
        console.log('🎯 [POSITIONING] Waiting for World class...');
        setTimeout(setupPositioningMock, 50);
        return;
      }
      
      const WorldClass = (window as any).__WorldClass;
      console.log('🎯 [POSITIONING] World class found, setting up position override');
      
      // Store original randomEmptyGrid method
      const originalRandomEmptyGrid = WorldClass.prototype.randomEmptyGrid;
      
      // Override randomEmptyGrid method
      WorldClass.prototype.randomEmptyGrid = function() {
        const mockConfig = (window as any).__mockActorPositioning;
        
        if (!mockConfig?.enabled) {
          console.log('🎯 [POSITIONING] Mock not enabled, using original method');
          return originalRandomEmptyGrid.call(this);
        }
        
        // We need to track which actor this is for, so we'll use a counter
        if (!mockConfig.actorIndex) {
          mockConfig.actorIndex = 0;
        }
        
        const actorIndex = mockConfig.actorIndex;
        mockConfig.actorIndex++;
        
        console.log(`🎯 [POSITIONING] Determining position for actor index ${actorIndex}`);
        
        // Check if we have fixed positions for specific actors
        if (mockConfig.config.fixedPositions && actorIndex < mockConfig.config.fixedPositions.length) {
          const fixedPosition = mockConfig.config.fixedPositions[actorIndex];
          const positionGrid = `${fixedPosition.x}:${fixedPosition.y}`;
          console.log(`🎯 [POSITIONING] Using fixed position ${actorIndex}:`, positionGrid);
          return positionGrid;
        } 
        
        // Check if we have custom spawn points to cycle through
        if (mockConfig.config.customSpawnPoints && mockConfig.config.customSpawnPoints.length > 0) {
          const spawnPoint = mockConfig.config.customSpawnPoints[mockConfig.spawnIndex % mockConfig.config.customSpawnPoints.length];
          const positionGrid = `${spawnPoint.x}:${spawnPoint.y}`;
          mockConfig.spawnIndex++;
          console.log(`🎯 [POSITIONING] Using custom spawn point:`, positionGrid);
          return positionGrid;
        }
        
        // Fall back to random if configured to do so
        if (mockConfig.config.useRandomForUnspecified !== false) {
          console.log(`🎯 [POSITIONING] Using random positioning for unspecified actor`);
          return originalRandomEmptyGrid.call(this);
        }
        
        console.warn(`🎯 [POSITIONING] No position configured for actor ${actorIndex}, using origin`);
        return '0:0'; // Default fallback
      };
      
      console.log('✅ [POSITIONING] Actor positioning mock installed successfully');
    };
    
    // Start the setup process
    setupPositioningMock();
  };
}