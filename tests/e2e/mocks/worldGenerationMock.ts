/**
 * World Generation Mock for E2E Tests
 * 
 * This mock patches world.generateWorld() to create a deterministic 24x24 square world.
 * The mock is applied after World class is exposed but before generateWorld() is called.
 */

export function getMockWorldGenerationScript(): string {
  return `
    (function() {
      console.log('🚀 [WORLD MOCK] Setting up world generation mock...');
      
      // Listen for World class to be exposed
      window.addEventListener('__worldClassReady', function(event) {
        console.log('✅ [WORLD MOCK] World class ready event received!');
        
        const World = event.detail.World;
        
        // Save original generateWorld method
        const originalGenerateWorld = World.prototype.generateWorld;
        
        // Replace with mock implementation
        World.prototype.generateWorld = function() {
          console.log('🎯 [WORLD MOCK] generateWorld() called - using mock implementation');
          
          // Check if dependencies are available
          if (!window.__WorldDependencies) {
            console.error('❌ [WORLD MOCK] Dependencies not available - falling back to original');
            return originalGenerateWorld.call(this);
          }
          
          const { Slab: SlabClass } = window.__WorldDependencies;
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
          
          console.log(\`✅ [WORLD MOCK] Created \${tileCount} grass slabs\`);
          
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
          if (window.__WorldDependencies && window.__WorldDependencies.Pathfinder) {
            console.log('🔧 [WORLD MOCK] Loading pathfinder...');
            window.__WorldDependencies.Pathfinder.loadMap(this.walkable);
          }
          
          // Calculate spawnable positions (exclude beacon at 0:0)
          const spawnablePositions = Object.keys(this.map).filter(key => key !== '0:0');
          
          // Call gameLogger like the real generateWorld does
          if (typeof window !== 'undefined' && window.gameLogger) {
            window.gameLogger.worldGenerated({
              totalTiles: Object.keys(this.map).length,
              spawnablePositions: spawnablePositions.length,
              worldSize: mockWorldSize,
              worldRadius: mockWorldRadius,
              mapBounds: this.mapBounds,
              mainIslandSize: this.islands[this.mainIsland]?.length || 0,
              totalIslands: this.islands.length,
              spawnPositions: spawnablePositions.slice(0, 10)
            });
            
            window.gameLogger.info('World: Created world', { tileCount: Object.keys(this.map).length });
          }
          
          console.log('✅ [WORLD MOCK] Mock world generation complete');
        };
        
        console.log('✅ [WORLD MOCK] World.prototype.generateWorld patched successfully');
        
        // Set flag for test verification
        window.__mockWorldGeneration = true;
        console.log('✅ [WORLD MOCK] Mock flag set: window.__mockWorldGeneration = true');
      }, { once: true });
      
      console.log('✅ [WORLD MOCK] Listener registered, waiting for World class...');
    })();
  `;
}
