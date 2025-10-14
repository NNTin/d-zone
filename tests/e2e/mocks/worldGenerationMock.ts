/**
 * World Generation Mock for E2E Tests
 * 
 * This mock patches world.generateWorld() to create deterministic test worlds.
 * Similar to the WebSocket mock, this returns a function that patches the World class.
 */

/**
 * World configuration type
 */
export interface MockWorldConfig {
  /** World size (width and height) */
  size: number;
  /** Coordinates to skip (holes in the world) */
  holes?: Array<{ x: number; y: number }>;
  /** Description for logging */
  description: string;
}

/**
 * Predefined world configurations
 */
export const MOCK_WORLDS = {
  /** Standard 24x24 square world with no holes */
  SQUARE_24X24: {
    size: 24,
    holes: [],
    description: '24x24 square world'
  } as MockWorldConfig,
  
  /** 24x24 world with a single hole at 5,5 */
  SQUARE_24X24_HOLE_5X5: {
    size: 24,
    holes: [{ x: 5, y: 5 }],
    description: '24x24 square world with hole at (5,5)'
  } as MockWorldConfig,
  
  /** 24x24 world with a horizontal line of holes from (1,5) to (7,5) */
  SQUARE_24X24_LINE_HOLES: {
    size: 24,
    holes: [
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 7, y: 5 }
    ],
    description: '24x24 square world with line of holes from (1,5) to (7,5)'
  } as MockWorldConfig
};

/**
 * Creates a mock world generation script with the specified configuration
 * The config will be passed as an argument when calling addInitScript
 */
export function getMockWorldGenerationScript() {
  return (configData: MockWorldConfig) => {
    console.log('🚀 [WORLD MOCK] Setting up world generation mock...');
    console.log('📋 [WORLD MOCK] Configuration:', configData.description);
    
    // Set flag IMMEDIATELY for test verification with config info
    (window as any).__mockWorldGeneration = {
      enabled: true,
      config: {
        size: configData.size,
        holes: configData.holes ? configData.holes.length : 0,
        description: configData.description
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
        console.log('📋 [WORLD MOCK] Generating:', configData.description);
        
        // Check if dependencies are available
        if (!(window as any).__WorldDependencies) {
          console.error('❌ [WORLD MOCK] Dependencies not available - falling back to original');
          return originalGenerateWorld.call(this);
        }
        
        const { Slab: SlabClass } = (window as any).__WorldDependencies;
        console.log('✅ [WORLD MOCK] Got dependencies, generating mock world...');
        
        const mockWorldSize = configData.size;
        const mockWorldRadius = configData.size / 2;
        
        // Convert holes array to a Set for O(1) lookup
        const holeSet = new Set(
          (configData.holes || []).map((hole: any) => `${hole.x}:${hole.y}`)
        );
        
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
            
            // Skip if this position is a hole
            if (holeSet.has(grid)) {
              skippedCount++;
              console.log(`⚫ [WORLD MOCK] Skipping hole at (${x}, ${y})`);
              continue;
            }
            
            const z = -0.5;
            
            // Create grass slab using the same constructor as the real world
            const slab = new SlabClass('grass', x, y, z);
            slab.grid = grid;
            this.map[grid] = slab;
            slab.addToGame(this.game);
            tileCount++;
          }
        }
        
        console.log(`✅ [WORLD MOCK] Created ${tileCount} grass slabs (${skippedCount} holes)`);
        
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
        
        // Set up unoccupiedGrids by calling the tail end of the original implementation
        // This is needed for actors to spawn via randomEmptyGrid()
        console.log('🔧 [WORLD MOCK] Finalizing world setup...');
        
        // Call the original to handle the unoccupiedGrids setup
        // But first, preserve our mock map
        const mockMap = this.map;
        const mockWalkable = this.walkable;
        const mockObjects = this.objects;
        const mockMapBounds = this.mapBounds;
        const mockStaticMap = this.staticMap;
        const mockIslands = this.islands;
        const mockMainIsland = this.mainIsland;
        
        // Call original which will set unoccupiedGrids
        originalGenerateWorld.call(this);
        
        // Restore our mock data
        this.map = mockMap;
        this.walkable = mockWalkable;
        this.objects = mockObjects;
        this.mapBounds = mockMapBounds;
        this.staticMap = mockStaticMap;
        this.islands = mockIslands;
        this.mainIsland = mockMainIsland;
        
        console.log('✅ [WORLD MOCK] Mock world generation complete');
      };
      
      console.log('✅ [WORLD MOCK] World.prototype.generateWorld patched successfully');
    }, { once: true });
    
    console.log('✅ [WORLD MOCK] Listener registered, waiting for World class...');
  };
}
