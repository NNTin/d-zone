/**
 * World Generation Mock for E2E Tests
 * 
 * This mock patches world.generateWorld() to create a deterministic 24x24 square world.
 * Similar to the WebSocket mock, this returns a function that patches the World class.
 */

export function getMockWorldGenerationScript() {
  return () => {
    console.log('🚀 [WORLD MOCK] Setting up world generation mock...');
    
    // Listen for World class to be exposed
    window.addEventListener('__worldClassReady', function(event) {
      console.log('✅ [WORLD MOCK] World class ready event received!');
      
      const World = (event as CustomEvent).detail.World;
      
      // Save original generateWorld method
      const originalGenerateWorld = World.prototype.generateWorld;
      
      // Replace with mock implementation
      World.prototype.generateWorld = function() {
        console.log('🎯 [WORLD MOCK] generateWorld() called - using mock implementation');
        
        // Check if dependencies are available
        if (!(window as any).__WorldDependencies) {
          console.error('❌ [WORLD MOCK] Dependencies not available - falling back to original');
          return originalGenerateWorld.call(this);
        }
        
        const { Slab: SlabClass } = (window as any).__WorldDependencies;
        console.log('✅ [WORLD MOCK] Got dependencies, generating 24x24 mock world...');
        
        const mockWorldSize = 24;
        const mockWorldRadius = 12;
        
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
        
        // Create a 24x24 square of grass tiles
        let tileCount = 0;
        for (let tx = 0; tx < mockWorldSize; tx++) {
          for (let ty = 0; ty < mockWorldSize; ty++) {
            const x = tx - mockWorldRadius;
            const y = ty - mockWorldRadius;
            const z = -0.5;
            
            const grid = x + ':' + y;
            
            // Create grass slab using the same constructor as the real world
            const slab = new SlabClass('grass', x, y, z);
            slab.grid = grid;
            this.map[grid] = slab;
            slab.addToGame(this.game);
            tileCount++;
          }
        }
        
        console.log(`✅ [WORLD MOCK] Created ${tileCount} grass slabs`);
        
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
      
      // Set flag for test verification
      (window as any).__mockWorldGeneration = true;
      console.log('✅ [WORLD MOCK] Mock flag set: window.__mockWorldGeneration = true');
    }, { once: true });
    
    console.log('✅ [WORLD MOCK] Listener registered, waiting for World class...');
  };
}
