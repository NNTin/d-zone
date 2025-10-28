/**
 * World Generation Mock for E2E Tests
 * 
 * This mock patches world.generateWorld() to create deterministic test worlds.
 * Similar to the WebSocket mock, this returns a function that patches the World class.
 */

/**
 * Island configuration for mock worlds
 */
export interface MockIsland {
  /** Shape type */
  shape: 'circle' | 'rectangle';
  /** Center position (for circles) or start position (for rectangles) */
  centerX?: number;
  centerY?: number;
  /** Radius of the island (for circles only) */
  radius?: number;
  /** Rectangle coordinates (for rectangles only) */
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  /** Island type (for different slab types: grass, plain, flowers) */
  type?: 'grass' | 'plain' | 'flowers';
}

/**
 * World configuration type
 */
export interface MockWorldConfig {
  /** World size (width and height) */
  size: number;
  /** Islands to generate */
  islands?: MockIsland[];
}

/**
 * Predefined world configurations
 */
export const MOCK_WORLDS = {
  SQUARE_24X24: {
    size: 24,
    islands: [
      { shape: 'circle', centerX: 0, centerY: 0, radius: 10, type: 'grass' }
    ]
  } as MockWorldConfig,
  
  GRID_SMALL_ISLANDS: {
    size: 24,
    islands: [
      { shape: 'circle', centerX: -6, centerY: -6, radius: 3, type: 'grass' },
      { shape: 'circle', centerX: 0, centerY: -6, radius: 3, type: 'grass' },
      { shape: 'circle', centerX: 6, centerY: -6, radius: 3, type: 'grass' },
      { shape: 'circle', centerX: -6, centerY: 0, radius: 3, type: 'grass' },
      { shape: 'circle', centerX: 0, centerY: 0, radius: 4, type: 'grass' },
      { shape: 'circle', centerX: 6, centerY: 0, radius: 3, type: 'grass' },
      { shape: 'circle', centerX: -6, centerY: 6, radius: 3, type: 'grass' },
      { shape: 'circle', centerX: 0, centerY: 6, radius: 3, type: 'grass' },
      { shape: 'circle', centerX: 6, centerY: 6, radius: 3, type: 'grass' }
    ]
  } as MockWorldConfig,
  
  GRID_MEDIUM_ISLANDS: {
    size: 24,
    islands: [
      { shape: 'circle', centerX: -4, centerY: -4, radius: 4, type: 'grass' },
      { shape: 'circle', centerX: 4, centerY: -4, radius: 4, type: 'grass' },
      { shape: 'circle', centerX: -4, centerY: 4, radius: 4, type: 'grass' },
      { shape: 'circle', centerX: 4, centerY: 4, radius: 4, type: 'grass' }
    ]
  } as MockWorldConfig,

  PARALLEL_LINES_BRIDGE: {
    size: 24,
    islands: [
      // vertical line (left side)
      { shape: 'rectangle', startX: -8, startY: -6, endX: -8, endY: 6, type: 'grass' },
      { shape: 'rectangle', startX: -6, startY: -6, endX: -6, endY: 6, type: 'grass' },
      // vertical line (right side)
      { shape: 'rectangle', startX: 8, startY: -6, endX: 8, endY: 6, type: 'grass' },
      // horizontal bridge connecting them
      { shape: 'rectangle', startX: -8, startY: 0, endX: 8, endY: 0, type: 'grass' }
    ]
  } as MockWorldConfig,

  PARALLEL_LINES_BRIDGE_V2: {
    size: 24,
    islands: [
      // horizontal line (top side) - rotated 90° from vertical left
      { shape: 'rectangle', startX: -6, startY: -8, endX: 6, endY: -8, type: 'grass' },
      { shape: 'rectangle', startX: -6, startY: -6, endX: 6, endY: -6, type: 'grass' },
      // horizontal line (bottom side) - rotated 90° from vertical right  
      { shape: 'rectangle', startX: -6, startY: 8, endX: 6, endY: 8, type: 'grass' },
      // vertical bridge connecting them - rotated 90° from horizontal bridge
      { shape: 'rectangle', startX: 0, startY: -8, endX: 0, endY: 8, type: 'grass' }
    ]
  } as MockWorldConfig
};

/**
 * Creates a mock world generation script with the specified configuration
 * The config will be passed as an argument when calling addInitScript
 */
export function getMockWorldGenerationScript() {
  return (configWithDescription: MockWorldConfig & { testDescription?: string }) => {
    const configData = configWithDescription;
    const testDescription = configWithDescription.testDescription;
    
    console.log('🚀 [WORLD MOCK] Setting up world generation mock...');
    console.log('📋 [WORLD MOCK] Configuration:', testDescription || `${configData.size}x${configData.size} world`);
    
    // Set flag IMMEDIATELY for test verification with config info
    (window as any).__mockWorldGeneration = {
      enabled: true,
      config: {
        size: configData.size,
        islands: configData.islands ? configData.islands.length : 0,
        description: testDescription || `${configData.size}x${configData.size} world`
      }
    };
    console.log('✅ [WORLD MOCK] Mock flag set immediately with configuration');
    
    // Listen for World class to be exposed
    window.addEventListener('__worldClassReady', function(event) {
      console.log('✅ [WORLD MOCK] World class ready event received!');
      
      const World = (event as CustomEvent).detail.World;
      
      // Save original generateWorld method
      const originalGenerateWorld = World.prototype.generateWorld;
      
      // Replace with mock implementation
      World.prototype.generateWorld = function() {
        console.log('🎯 [WORLD MOCK] generateWorld() called - using mock implementation');
        console.log('📋 [WORLD MOCK] Generating:', testDescription || `${configData.size}x${configData.size} world`);
        
        // Check if dependencies are available
        if (!(window as any).__WorldDependencies) {
          console.error('❌ [WORLD MOCK] Dependencies not available - falling back to original');
          return originalGenerateWorld.call(this);
        }
        
        const { Slab: SlabClass } = (window as any).__WorldDependencies;
        console.log('✅ [WORLD MOCK] Got dependencies, generating mock world...');
        
        const mockWorldSize = configData.size;
        const mockWorldRadius = configData.size / 2;
        
        // Helper function to check if a position is within any island
        const isInsideAnyIsland = (x: number, y: number): { inside: boolean, type?: string } => {
          if (!configData.islands || configData.islands.length === 0) {
            return { inside: false };
          }
          
          for (const island of configData.islands) {
            let isInside = false;
            
            if (island.shape === 'circle') {
              // Circle detection (existing logic)
              if (island.centerX !== undefined && island.centerY !== undefined && island.radius !== undefined) {
                const dx = x - island.centerX;
                const dy = y - island.centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                isInside = distance <= island.radius;
              }
            } else if (island.shape === 'rectangle') {
              // Rectangle detection (new logic)
              if (island.startX !== undefined && island.startY !== undefined && 
                  island.endX !== undefined && island.endY !== undefined) {
                const minX = Math.min(island.startX, island.endX);
                const maxX = Math.max(island.startX, island.endX);
                const minY = Math.min(island.startY, island.endY);
                const maxY = Math.max(island.startY, island.endY);
                isInside = x >= minX && x <= maxX && y >= minY && y <= maxY;
              }
            }
            
            if (isInside) {
              return { inside: true, type: island.type || 'grass' };
            }
          }
          
          return { inside: false };
        };
        
        // Clear existing data
        this.map = {};
        this.walkable = {};
        this.objects = {};
        this.mapBounds = { 
          xl: -mockWorldRadius, 
          yl: -mockWorldRadius, 
          xh: mockWorldRadius - 1, 
          yh: mockWorldRadius - 1 
        };
        
        // Create tiles based on configuration
        let tileCount = 0;
        let skippedCount = 0;
        
        for (let tx = 0; tx < mockWorldSize; tx++) {
          for (let ty = 0; ty < mockWorldSize; ty++) {
            const x = tx - mockWorldRadius;
            const y = ty - mockWorldRadius;
            const grid = x + ':' + y;
            
            // Check if this position is inside any island
            const islandCheck = isInsideAnyIsland(x, y);
            
            if (!islandCheck.inside) {
              skippedCount++;
              continue;
            }
            
            const z = -0.5;
            const slabType = islandCheck.type || 'grass';
            
            // Create slab using the island's type
            const slab = new SlabClass(slabType, x, y, z);
            slab.grid = grid;
            this.map[grid] = slab;
            slab.addToGame(this.game);
            tileCount++;
          }
        }
        
        console.log(`✅ [WORLD MOCK] Created ${tileCount} slabs across ${configData.islands?.length || 0} islands (${skippedCount} void positions)`);
        
        // Call geometry.generateClosestGrids to initialize pathfinding arrays
      console.log('🔧 [WORLD MOCK] Generating closest grids...');
      if ((window as any).__WorldDependencies && (window as any).__WorldDependencies.geometry) {
        (window as any).__WorldDependencies.geometry.generateClosestGrids(mockWorldSize);
        console.log(`✅ [WORLD MOCK] Generated ${(window as any).__WorldDependencies.geometry.closestGrids.length} closest grid positions`);
      }
      
      // Initialize static map and islands
        this.staticMap = [];
        this.islands = [];
        this.mainIsland = 0;
        
        // Call the helper methods like the real generateWorld does
        console.log('🔧 [WORLD MOCK] Crawling map...');
        this.crawlMap(); // This will set up islands and borders
        
        console.log('🔧 [WORLD MOCK] Creating tiles...');
        this.createTiles(); // This will create the tile map
        
        console.log('🔧 [WORLD MOCK] Creating background...');
        this.createBackground(); // This will render the background
        
        // Load pathfinder
        if ((window as any).__WorldDependencies && (window as any).__WorldDependencies.Pathfinder) {
          console.log('🔧 [WORLD MOCK] Loading pathfinder...');
          (window as any).__WorldDependencies.Pathfinder.loadMap(this.walkable);
        }
        
        // Set up unoccupiedGrids manually for actor spawning
        // This is needed for actors to spawn via randomEmptyGrid()
        console.log('🔧 [WORLD MOCK] Finalizing world setup...');
        
        // Set up unoccupiedGrids directly without calling original
        this.unoccupiedGrids = [];
        for (const grid in this.map) {
          if (this.map[grid] && !this.objects[grid]) {
            this.unoccupiedGrids.push(grid);
          }
        }
        
        // CRITICAL: Set the global unoccupiedGrids that randomEmptyGrid() actually uses
        // The method uses the global variable, not this.unoccupiedGrids
        if ((window as any).__setUnoccupiedGrids) {
          (window as any).__setUnoccupiedGrids([...this.unoccupiedGrids]);
          console.log(`🔧 [WORLD MOCK] Set global unoccupiedGrids to ${this.unoccupiedGrids.length} positions`);
        } else {
          console.warn('🚨 [WORLD MOCK] __setUnoccupiedGrids not available - actors may not spawn');
        }
        
        console.log(`🔧 [WORLD MOCK] Set up ${this.unoccupiedGrids.length} unoccupied grids for spawning`);
        
        // Emit the world:generated event that tests are waiting for
        if ((window as any).gameLogger && (window as any).gameLogger.worldGenerated) {
          (window as any).gameLogger.worldGenerated({
            totalTiles: tileCount,
            spawnablePositions: this.unoccupiedGrids.length,
            worldSize: configData.size,
            worldRadius: mockWorldRadius,
            islands: configData.islands?.length || 0,
            mapBounds: this.mapBounds,
            mainIslandSize: tileCount, // All tiles are on "islands" in our mock
            totalIslands: configData.islands?.length || 0,
            spawnPositions: this.unoccupiedGrids.slice(0, 10) // First 10 spawn positions as sample
          });
        }
        
        console.log('✅ [WORLD MOCK] Mock world generation complete');
      };
      
      console.log('✅ [WORLD MOCK] World.prototype.generateWorld patched successfully');
    }, { once: true });
    
    console.log('✅ [WORLD MOCK] Listener registered, waiting for World class...');
  };
}
