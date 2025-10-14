/**
 * @file E2E tests for world generation
 * @description Tests that validate world generation
 * 
 * This test suite verifies that:
 * 1. Actors spawn on the world after initialization (critical - requires WebSocket)
 * 2. Actors can be spawned on a mock world with mocked WebSocket communication (normal)
 */

import { expect, test } from '@playwright/test';
import { getMockWebSocketScript, getMockWorldGenerationScript, MOCK_WORLDS, type MockWorldConfig } from './mocks/apiHandlers.js';
import { CanvasGameTestUtils, GameAssertions } from './utils/canvasTestUtils.js';
import {
  extractSpawnAnalysisData,
  getActorSpawnLogs,
  getSpawnAnalysisLogs,
  getWorldGenerationData,
  type ActorCoordinates
} from './utils/spawnValidationUtils.js';

test.describe('@critical World Generation', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
    
    // Navigate to the game
    await page.goto('/?e2e-test=true');
    
    // Verify canvas is visible before testing
    await GameAssertions.assertCanvasVisible(page);
  });

  test('@critical should spawn actors on the world', async ({ page }) => {
    // Wait for game and world initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Get world data using utility
    const worldData = getWorldGenerationData(gameUtils);
    expect(worldData).toBeTruthy();
    
    // Get spawn position analysis using utility
    const spawnAnalysisData = extractSpawnAnalysisData(getSpawnAnalysisLogs(gameUtils));
    const validSpawnPositions = spawnAnalysisData?.validPositions || [];
    const invalidSpawnPositions = spawnAnalysisData?.invalidPositions || [];
    
    // Get actor spawn logs using utility
    const spawnLogs = getActorSpawnLogs(gameUtils);
    console.log(`📊 Found ${spawnLogs.length} actor spawn(s) on the world`);
    
    // Verify that at least some actors have spawned
    expect(spawnLogs.length).toBeGreaterThan(0);
    
    // Verify spawn analysis data is available
    expect(validSpawnPositions.length).toBeGreaterThan(0);
    console.log(`📊 World has ${validSpawnPositions.length} valid spawn positions, ${invalidSpawnPositions.length} invalid positions`);
    
    // Validate all spawned actors have valid coordinates
    for (const spawnLog of spawnLogs) {
      const coords: ActorCoordinates = {
        uid: spawnLog.data.uid,
        username: spawnLog.data.username,
        x: spawnLog.data.x,
        y: spawnLog.data.y,
        z: spawnLog.data.z
      };
      
      // Check if actor spawned in a position that was marked as valid
      const actorPosition = `${coords.x}:${coords.y}`;
      const isValidPosition = validSpawnPositions.includes(actorPosition);
      
      if (!isValidPosition) {
        console.log(`❌ Actor ${coords.username} spawned at INVALID position (${coords.x}, ${coords.y}, ${coords.z}) - not in valid spawn list`);
        console.log(`📍 Valid positions sample: ${validSpawnPositions.slice(0, 10).join(', ')}`);
        console.log(`🚫 Invalid positions: ${invalidSpawnPositions.join(', ')}`);
        
        // The test should fail when actors spawn at invalid positions
        expect(isValidPosition).toBe(true);
      } else {
        console.log(`✓ Actor ${coords.username} spawned at VALID position (${coords.x}, ${coords.y}, ${coords.z})`);
      }
    }
    
    console.log(`✅ All ${spawnLogs.length} actors spawned with valid coordinates on the world`);
  });

  test('@normal should spawn 3 mock actors', async ({ page }) => {
    console.log('🧪 Testing actor spawning on mock world with WebSocket mock');
    
    // Mock WebSocket BEFORE page loads to intercept the connection
    console.log('🔌 Setting up WebSocket mock...');
    await page.addInitScript(getMockWebSocketScript());
    
    console.log('🌐 Loading page with mocked WebSocket...');
    await page.goto('/?e2e-test=true');
    
    // Verify canvas is visible
    await GameAssertions.assertCanvasVisible(page);
    
    // Verify WebSocket was mocked
    const isMocked = await page.evaluate(() => {
      return (window as any).WebSocket.name === 'MockWebSocket';
    });
    console.log(`✓ WebSocket mocked: ${isMocked}`);
    expect(isMocked).toBe(true);
    
    // Wait for game initialization
    console.log('⏳ Waiting for game initialization...');
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    console.log('✓ Game initialized');
    
    // Wait for world generation
    console.log('⏳ Waiting for world generation...');
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    console.log('✓ World generated');
    
    // Get world data
    const worldData = getWorldGenerationData(gameUtils);
    expect(worldData).toBeTruthy();
    console.log(`📊 World created with ${worldData!.totalTiles} tiles`);
    
    // Wait for actors to spawn from our mock data
    console.log('⏳ Waiting for mock actors to spawn...');
    await page.waitForTimeout(2000); // Give time for actors to be processed
    
    // Get spawned actors
    const spawnLogs = getActorSpawnLogs(gameUtils);
    console.log(`📊 Found ${spawnLogs.length} actor spawn(s) on the mock world`);
    
    // Verify we have the expected mock actors
    expect(spawnLogs.length).toBeGreaterThanOrEqual(3);
    
    // Verify each mock actor spawned by username only (spawn positions are determined by the game)
    const expectedActorNames = ['MockActor1', 'MockActor2', 'MockActor3'];
    
    for (const expectedName of expectedActorNames) {
      const actorLog = spawnLogs.find(log => log.data.username === expectedName);
      expect(actorLog).toBeTruthy();
      
      if (actorLog) {
        console.log(`✓ Mock actor ${expectedName} (${actorLog.data.uid}) spawned at position (${actorLog.data.x}, ${actorLog.data.y}, ${actorLog.data.z})`);
      }
    }
    
    console.log(`✅ All ${expectedActorNames.length} mock actors spawned successfully on the mock world`);
  });

  test('@normal should generate a 24x24 mock world with 3 mock actors', async ({ page }) => {
    console.log('🧪 Testing 24x24 mock square world generation with mocked WebSocket and world generation');
    
    // Listen to ALL browser console logs for debugging
    page.on('console', msg => {
      const text = msg.text();
      console.log(`[BROWSER] ${text}`);
    });
    
    // Mock WebSocket BEFORE page loads (using the same mock as the previous test)
    console.log('🔌 Setting up WebSocket mock...');
    await page.addInitScript(getMockWebSocketScript());
    
    // Mock World Generation BEFORE page loads
    console.log('🌍 Setting up World generation mock...');
    const mockScript = getMockWorldGenerationScript();
    await page.addInitScript(mockScript, MOCK_WORLDS.SQUARE_24X24);
    
    console.log('🌐 Loading page with mocked WebSocket and World...');
    await page.goto('/?e2e-test=true');
    
    // Check if mock was set up
    const mockStatus = await page.evaluate(() => {
      return {
        mockWorldGeneration: (window as any).__mockWorldGeneration,
        mockWorldSize: (window as any).__mockWorldSize,
        defineWrapped: typeof (window as any).define === 'function'
      };
    });
    console.log('🔍 Mock status after page load:', mockStatus);
    
    // Verify canvas is visible
    await GameAssertions.assertCanvasVisible(page);
    
    // Verify WebSocket was mocked
    const isMocked = await page.evaluate(() => {
      return (window as any).WebSocket.name === 'MockWebSocket';
    });
    console.log(`✓ WebSocket mocked: ${isMocked}`);
    expect(isMocked).toBe(true);
    
    // Verify World generation mock flag is set
    const worldMockInfo = await page.evaluate(() => {
      return (window as any).__mockWorldGeneration;
    });
    console.log(`✓ World generation mocked:`, worldMockInfo);
    expect(worldMockInfo?.enabled).toBe(true);
    
    // Wait for game initialization
    console.log('⏳ Waiting for game initialization...');
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    console.log('✓ Game initialized');
    
    // Wait for world generation
    console.log('⏳ Waiting for world generation...');
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    console.log('✓ World generated');
    
    // Wait for tile map to be logged
    console.log('⏳ Waiting for tile map...');
    await gameUtils.waitForGameEvent('world', 'tile_map', 5000);
    console.log('✓ Tile map created');
    
    // Get world data
    const worldData = getWorldGenerationData(gameUtils);
    expect(worldData).toBeTruthy();
    console.log(`📊 World created with ${worldData!.totalTiles} tiles`);
    
    // Get tile map data
    const worldLogs = gameUtils.getLogsByCategory('world');
    const tileMapLogs = worldLogs.filter(log => log.event === 'tile_map');
    expect(tileMapLogs.length).toBeGreaterThan(0);
    
    const tileMapData = tileMapLogs[0].data;
    console.log(`📊 Tile map: ${tileMapData.totalTiles} tiles, ${tileMapData.uniqueTileCodes} unique codes`);
    console.log(`📊 Grid tile types: ${Object.keys(tileMapData.gridTileTypes).length} positions`);
    
    // Verify the world is a 24x24 square (expecting 576 grid positions for perfect square)
    // The mock ensures all tiles are land, creating a perfect square island
    const gridPositions = Object.keys(tileMapData.gridTileTypes);
    console.log(`📍 First 20 grid positions: ${gridPositions.slice(0, 20).join(', ')}`);
    console.log(`📍 Total grid positions: ${gridPositions.length}`);
    
    // For a 24x24 world with flat terrain, we expect exactly 576 positions (24*24)
    // With the mock, all tiles should be land since noise values are 0.1
    expect(gridPositions.length).toBeGreaterThanOrEqual(500); // At least 500 positions
    expect(gridPositions.length).toBeLessThanOrEqual(600); // But not more than 600
    
    // Verify tile types - with flat terrain, should be mostly grass
    const tileTypes = Object.values(tileMapData.gridTileTypes);
    const hasGrass = tileTypes.includes('grass');
    console.log(`✓ World has grass tiles: ${hasGrass}`);
    
    // All tiles should be land (no water) with our flat terrain mock
    const allLand = tileTypes.every(type => type !== 'water' && type !== 'deepwater');
    console.log(`✓ All tiles are land (no water): ${allLand}`);
    expect(allLand).toBe(true);
    
    // Wait for actors to spawn from our mock data
    console.log('⏳ Waiting for mock actors to spawn...');
    await page.waitForTimeout(2000);
    
    // Get spawned actors
    const spawnLogs = getActorSpawnLogs(gameUtils);
    console.log(`📊 Found ${spawnLogs.length} actor spawn(s) on the mock world`);
    
    // Verify we have the expected mock actors
    expect(spawnLogs.length).toBeGreaterThanOrEqual(3);
    
    // Verify each mock actor spawned by username only
    const expectedActorNames = ['MockActor1', 'MockActor2', 'MockActor3'];
    
    for (const expectedName of expectedActorNames) {
      const actorLog = spawnLogs.find(log => log.data.username === expectedName);
      expect(actorLog).toBeTruthy();
      
      if (actorLog) {
        const x = actorLog.data.x;
        const y = actorLog.data.y;
        const z = actorLog.data.z;
        console.log(`✓ Mock actor ${expectedName} (${actorLog.data.uid}) spawned at position (${x}, ${y}, ${z})`);
        
        // Verify actor spawned on a valid grid position
        const gridKey = `${x}:${y}`;
        const isOnValidGrid = gridPositions.includes(gridKey);
        expect(isOnValidGrid).toBe(true);
        console.log(`  ✓ Position ${gridKey} is on the generated world grid`);
      }
    }
    
    console.log(`✅ All ${expectedActorNames.length} mock actors spawned successfully on the 24x24 mock square world`);
    console.log(`📊 Final world stats: ${gridPositions.length} grid positions, ${tileMapData.totalTiles} total tiles`);
  });
});

/**
 * Helper function to test mock world generation with a specific configuration
 * Reduces code duplication across mock world tests
 */
async function testMockWorldGeneration(
  page: any,
  gameUtils: CanvasGameTestUtils,
  worldConfig: MockWorldConfig,
  testDescription: string
) {
  console.log(`🧪 ${testDescription}`);
  
  // Listen to ALL browser console logs for debugging
  page.on('console', (msg: any) => {
    const text = msg.text();
    console.log(`[BROWSER] ${text}`);
  });
  
  // Mock WebSocket BEFORE page loads
  console.log('🔌 Setting up WebSocket mock...');
  await page.addInitScript(getMockWebSocketScript());
  
  // Mock World Generation BEFORE page loads with specific config
  console.log(`🌍 Setting up World generation mock (${worldConfig.description})...`);
  const mockScript = getMockWorldGenerationScript();
  await page.addInitScript(mockScript, worldConfig);
  
  console.log('🌐 Loading page with mocked WebSocket and World...');
  await page.goto('/?e2e-test=true');
  
  // Verify canvas is visible
  await GameAssertions.assertCanvasVisible(page);
  
  // Verify WebSocket was mocked
  const isMocked = await page.evaluate(() => {
    return (window as any).WebSocket.name === 'MockWebSocket';
  });
  console.log(`✓ WebSocket mocked: ${isMocked}`);
  expect(isMocked).toBe(true);
  
  // Verify World generation mock flag is set
  const worldMockInfo = await page.evaluate(() => {
    return (window as any).__mockWorldGeneration;
  });
  console.log(`✓ World generation mocked:`, worldMockInfo);
  expect(worldMockInfo?.enabled).toBe(true);
  expect(worldMockInfo?.config?.description).toBe(worldConfig.description);
  
  // Wait for game initialization
  console.log('⏳ Waiting for game initialization...');
  await gameUtils.waitForGameEvent('game', 'initialized', 15000);
  console.log('✓ Game initialized');
  
  // Wait for world generation
  console.log('⏳ Waiting for world generation...');
  await gameUtils.waitForGameEvent('world', 'generated', 10000);
  console.log('✓ World generated');
  
  // Wait for tile map to be logged
  console.log('⏳ Waiting for tile map...');
  await gameUtils.waitForGameEvent('world', 'tile_map', 5000);
  console.log('✓ Tile map created');
  
  // Get world data
  const worldData = getWorldGenerationData(gameUtils);
  expect(worldData).toBeTruthy();
  console.log(`📊 World created with ${worldData!.totalTiles} tiles`);
  
  // Get tile map data
  const worldLogs = gameUtils.getLogsByCategory('world');
  const tileMapLogs = worldLogs.filter(log => log.event === 'tile_map');
  expect(tileMapLogs.length).toBeGreaterThan(0);
  
  const tileMapData = tileMapLogs[0].data;
  console.log(`📊 Tile map: ${tileMapData.totalTiles} tiles, ${tileMapData.uniqueTileCodes} unique codes`);
  
  const gridPositions = Object.keys(tileMapData.gridTileTypes);
  console.log(`📊 Grid tile types: ${gridPositions.length} positions`);
  
  // Calculate expected tile count (size^2 - number of holes)
  const expectedTileCount = (worldConfig.size * worldConfig.size) - (worldConfig.holes?.length || 0);
  console.log(`📊 Expected tiles: ${expectedTileCount} (${worldConfig.size}x${worldConfig.size} - ${worldConfig.holes?.length || 0} holes)`);
  
  // Verify the expected number of positions (with some tolerance for edge tiles)
  expect(gridPositions.length).toBeGreaterThanOrEqual(expectedTileCount - 10);
  expect(gridPositions.length).toBeLessThanOrEqual(expectedTileCount + 10);
  
  // Verify holes are not in the grid
  if (worldConfig.holes && worldConfig.holes.length > 0) {
    for (const hole of worldConfig.holes) {
      const holeKey = `${hole.x}:${hole.y}`;
      const isHolePresent = gridPositions.includes(holeKey);
      expect(isHolePresent).toBe(false);
      console.log(`✓ Hole at (${hole.x}, ${hole.y}) verified - not in grid`);
    }
  }
  
  // Verify all tiles are land (no water)
  const tileTypes = Object.values(tileMapData.gridTileTypes);
  const allLand = tileTypes.every((type: any) => type !== 'water' && type !== 'deepwater');
  console.log(`✓ All tiles are land (no water): ${allLand}`);
  expect(allLand).toBe(true);
  
  // Wait for actors to spawn from our mock data
  console.log('⏳ Waiting for mock actors to spawn...');
  await page.waitForTimeout(2000);
  
  // Get spawned actors
  const spawnLogs = getActorSpawnLogs(gameUtils);
  console.log(`📊 Found ${spawnLogs.length} actor spawn(s) on the mock world`);
  
  // Verify we have the expected mock actors
  expect(spawnLogs.length).toBeGreaterThanOrEqual(3);
  
  // Verify each mock actor spawned and is on a valid (non-hole) position
  const expectedActorNames = ['MockActor1', 'MockActor2', 'MockActor3'];
  
  for (const expectedName of expectedActorNames) {
    const actorLog = spawnLogs.find(log => log.data.username === expectedName);
    expect(actorLog).toBeTruthy();
    
    if (actorLog) {
      const x = actorLog.data.x;
      const y = actorLog.data.y;
      const z = actorLog.data.z;
      console.log(`✓ Mock actor ${expectedName} (${actorLog.data.uid}) spawned at position (${x}, ${y}, ${z})`);
      
      // Verify actor spawned on a valid grid position
      const gridKey = `${x}:${y}`;
      const isOnValidGrid = gridPositions.includes(gridKey);
      expect(isOnValidGrid).toBe(true);
      console.log(`  ✓ Position ${gridKey} is on the generated world grid`);
      
      // Verify actor did NOT spawn in a hole
      if (worldConfig.holes && worldConfig.holes.length > 0) {
        const isInHole = worldConfig.holes.some(hole => hole.x === x && hole.y === y);
        expect(isInHole).toBe(false);
        console.log(`  ✓ Position ${gridKey} is not a hole`);
      }
    }
  }
  
  console.log(`✅ All ${expectedActorNames.length} mock actors spawned successfully on ${worldConfig.description}`);
  console.log(`📊 Final world stats: ${gridPositions.length} grid positions, ${tileMapData.totalTiles} total tiles`);
}

test.describe('@normal Mock World Configurations', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
  });

  test('@normal should generate 24x24 world with single hole at (5,5)', async ({ page }) => {
    await testMockWorldGeneration(
      page,
      gameUtils,
      MOCK_WORLDS.SQUARE_24X24_HOLE_5X5,
      'Testing 24x24 world with single hole at (5,5)'
    );
  });

  test('@normal should generate 24x24 world with line of holes', async ({ page }) => {
    await testMockWorldGeneration(
      page,
      gameUtils,
      MOCK_WORLDS.SQUARE_24X24_LINE_HOLES,
      'Testing 24x24 world with horizontal line of holes from (1,5) to (7,5)'
    );
  });
});
