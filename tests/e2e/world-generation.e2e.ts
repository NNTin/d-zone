/**
 * @file E2E tests for world generation
 * @description Tests that validate world generation
 * 
 * This test suite verifies that:
 * 1. Actors spawn on the world after initialization (critical - requires WebSocket)
 * 2. Actors can be spawned on a mock world with mocked WebSocket communication (normal)
 */

import { expect, test } from '@playwright/test';
import {
  generateCustomMockActors,
  generateDefaultMockActors,
  getMockActorPositioningScript,
  getMockWebSocketScript,
  getMockWebSocketScriptWithActors,
  getMockWorldGenerationScript,
  MOCK_WORLDS,
  MockActorPositioning,
  MockWorldConfig
} from './mocks/index';
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
  // Listen to ALL browser console logs for debugging
  page.on('console', (msg: any) => {
    const text = msg.text();
    console.log(`[BROWSER] ${text}`);
  });
  
  // Mock WebSocket BEFORE page loads
  console.log('🔌 Setting up WebSocket mock...');
  await page.addInitScript(getMockWebSocketScript());
  
  // Mock World Generation BEFORE page loads with specific config
  console.log(`🌍 Setting up World generation mock (${testDescription})...`);
  const mockScript = getMockWorldGenerationScript();
  await page.addInitScript(mockScript, { ...worldConfig, testDescription });
  
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
  expect(worldMockInfo?.config?.description).toBe(testDescription);
  
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
  
  // Calculate expected tile count based on islands
  let expectedTileCount = 0;
  if (worldConfig.islands && worldConfig.islands.length > 0) {
    // Estimate tiles based on island areas (rough calculation)
    for (const island of worldConfig.islands) {
      let islandArea = 0;
      
      if (island.shape === 'circle') {
        // Circle area: π * r²
        if (island.radius !== undefined) {
          islandArea = Math.PI * island.radius * island.radius;
        }
      } else if (island.shape === 'rectangle') {
        // Rectangle area: width * height
        if (island.startX !== undefined && island.startY !== undefined && 
            island.endX !== undefined && island.endY !== undefined) {
          const width = Math.abs(island.endX - island.startX) + 1;
          const height = Math.abs(island.endY - island.startY) + 1;
          islandArea = width * height;
        }
      }
      
      expectedTileCount += Math.floor(islandArea);
    }
  } else {
    // No islands configured, expect no tiles
    expectedTileCount = 0;
  }
  
  console.log(`📊 Estimated tiles: ~${expectedTileCount} across ${worldConfig.islands?.length || 0} islands`);
  
  // Verify we have some reasonable number of positions (islands should generate tiles)
  if (worldConfig.islands && worldConfig.islands.length > 0) {
    expect(gridPositions.length).toBeGreaterThan(0);
    console.log(`✓ Generated ${gridPositions.length} tile positions from ${worldConfig.islands.length} islands`);
  }
  
  // Verify all tiles are land (no void)
  const tileTypes = Object.values(tileMapData.gridTileTypes);
  const allLand = tileTypes.every((type: any) => type == 'grass' || type == 'plain' || type == 'flowers');
  console.log(`✓ All tiles are land (no void): ${allLand}`);
  expect(allLand).toBe(true);
  
  // Wait for actors to spawn from our mock data
  console.log('⏳ Waiting for mock actors to spawn...');
  await page.waitForTimeout(2000);
  
  // Get spawned actors
  const spawnLogs = getActorSpawnLogs(gameUtils);
  console.log(`📊 Found ${spawnLogs.length} actor spawn(s) on the mock world`);
  
  // Verify we have the expected mock actors
  expect(spawnLogs.length).toBeGreaterThanOrEqual(3);

  // Helper function to check if the actor is on ground (has a tile)
  const isOnGround = (x: number, y: number): boolean => {
    const gridKey = `${x}:${y}`;
    return gridPositions.includes(gridKey);
  };

  // Verify each mock actor spawned and is on a valid island position
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
      
      // Verify actor spawned inside an island (if islands are configured)
      if (worldConfig.islands && worldConfig.islands.length > 0) {
        const isOnIsland = isOnGround(x, y);
        expect(isOnIsland).toBe(true);
        console.log(`  ✓ Position ${gridKey} is within an island`);
      }
    }
  }
  
  console.log(`✅ All ${expectedActorNames.length} mock actors spawned successfully on ${testDescription}`);
  console.log(`📊 Final world stats: ${gridPositions.length} grid positions, ${tileMapData.totalTiles} total tiles`);
}

test.describe('@normal Mock World Configurations', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
  });

  test('@normal should generate 24x24 world with single large island', async ({ page }, testInfo) => {
    await testMockWorldGeneration(
      page,
      gameUtils,
      MOCK_WORLDS.SQUARE_24X24,
      testInfo.title.replace('@normal should ', '')
    );
  });

  test('@normal should generate 24x24 world with 3x3 grid of small islands', async ({ page }, testInfo) => {
    await testMockWorldGeneration(
      page,
      gameUtils,
      MOCK_WORLDS.GRID_SMALL_ISLANDS,
      testInfo.title.replace('@normal should ', '')
    );
  });

  test('@normal should generate 24x24 world with 2x2 grid of medium islands', async ({ page }, testInfo) => {
    await testMockWorldGeneration(
      page,
      gameUtils,
      MOCK_WORLDS.GRID_MEDIUM_ISLANDS,
      testInfo.title.replace('@normal should ', '')
    );
  });

  test('@normal should generate 24x24 world with parallel lines connected by bridge', async ({ page }, testInfo) => {
    await testMockWorldGeneration(
      page,
      gameUtils,
      MOCK_WORLDS.PARALLEL_LINES_BRIDGE,
      testInfo.title.replace('@normal should ', '')
    );
  });

  test('@normal should generate 24x24 world with parallel lines connected by bridge v2', async ({ page }, testInfo) => {
    await testMockWorldGeneration(
      page,
      gameUtils,
      MOCK_WORLDS.PARALLEL_LINES_BRIDGE_V2,
      testInfo.title.replace('@normal should ', '')
    );
  });
});

test.describe('@normal Configurable Mock Actors', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
  });

  test('@normal should spawn custom configured actors on mock world', async ({ page }, testInfo) => {
    const customActors = generateCustomMockActors(['Alice', 'Bob', 'Charlie', 'Diana']);
    const testDescription = testInfo.title.replace('@normal should ', '');
    
    console.log('🎭 Setting up custom mock actors test...');
    console.log(`🎯 Configured actors: ${customActors.map(a => a.username).join(', ')}`);
    
    // Set up world generation mock
    await page.addInitScript(getMockWorldGenerationScript(), {
      ...MOCK_WORLDS.SQUARE_24X24,
      testDescription
    });
    
    // Set up WebSocket mock with custom actors
    await page.addInitScript(getMockWebSocketScriptWithActors(), {
      serverId: 'custom-test',
      serverName: 'Custom Actor Test Server',
      actors: customActors
    });
    
    // Navigate to the game
    await page.goto('/?e2e-test=true');
    
    // Verify both mocks are set up
    const mockInfo = await page.evaluate(() => ({
      websocket: (window as any).__mockWebSocket || false,
      world: (window as any).__mockWorldGeneration || false
    }));
    
    console.log('✓ Mock setup verified:', mockInfo);
    
    // Wait for game initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Wait for actors to spawn
    console.log('⏳ Waiting for custom actors to spawn...');
    await page.waitForTimeout(3000);
    
    // Get spawned actors
    const spawnLogs = getActorSpawnLogs(gameUtils);
    console.log(`📊 Found ${spawnLogs.length} actor spawn(s) on the custom world`);
    
    // Verify all custom actors spawned
    expect(spawnLogs.length).toBe(customActors.length);
    
    // Verify each custom actor spawned with correct username
    for (const expectedActor of customActors) {
      const actorLog = spawnLogs.find(log => log.data.username === expectedActor.username);
      expect(actorLog).toBeTruthy();
      
      if (actorLog) {
        console.log(`✓ Custom actor ${expectedActor.username} (${actorLog.data.uid}) spawned at position (${actorLog.data.x}, ${actorLog.data.y}, ${actorLog.data.z})`);
        
        // Verify actor spawned on valid world position
        const worldData = getWorldGenerationData(gameUtils);
        expect(worldData).toBeTruthy();
        
        // Check spawn position is within world bounds
        const { x, y } = actorLog.data;
        expect(x).toBeGreaterThanOrEqual(worldData!.mapBounds.xl);
        expect(x).toBeLessThanOrEqual(worldData!.mapBounds.xh);
        expect(y).toBeGreaterThanOrEqual(worldData!.mapBounds.yl);
        expect(y).toBeLessThanOrEqual(worldData!.mapBounds.yh);
      }
    }
    
    console.log(`✅ All ${customActors.length} custom actors spawned successfully: ${customActors.map(a => a.username).join(', ')}`);
  });

  test('@normal should spawn variable number of actors', async ({ page }, testInfo) => {
    const actorCount = 6;
    const defaultActors = generateDefaultMockActors(actorCount);
    const testDescription = testInfo.title.replace('@normal should ', '');
    
    console.log(`🎭 Setting up ${actorCount} default mock actors test...`);
    
    // Set up world generation mock
    await page.addInitScript(getMockWorldGenerationScript(), {
      ...MOCK_WORLDS.GRID_MEDIUM_ISLANDS,
      testDescription
    });
    
    // Set up WebSocket mock with variable number of actors
    await page.addInitScript(getMockWebSocketScriptWithActors(), {
      serverId: 'variable-test',
      serverName: 'Variable Actor Count Test',
      actors: defaultActors
    });
    
    // Navigate to the game
    await page.goto('/?e2e-test=true');
    
    // Wait for game initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Wait for actors to spawn
    console.log(`⏳ Waiting for ${actorCount} actors to spawn...`);
    await page.waitForTimeout(3000);
    
    // Get spawned actors
    const spawnLogs = getActorSpawnLogs(gameUtils);
    console.log(`📊 Found ${spawnLogs.length} actor spawn(s) on the world`);
    
    // Verify correct number of actors spawned
    expect(spawnLogs.length).toBe(actorCount);
    
    // Verify all actors have unique positions
    const positions = spawnLogs.map(log => `${log.data.x}:${log.data.y}`);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(spawnLogs.length);
    
    // Verify all actors have sequential naming
    const expectedUsernames = defaultActors.map(a => a.username).sort();
    const actualUsernames = spawnLogs.map(log => log.data.username).sort();
    expect(actualUsernames).toEqual(expectedUsernames);
    
    console.log(`✅ Successfully spawned ${actorCount} actors with unique positions and correct naming`);
  });

  test('@normal should spawn actors at custom fixed positions', async ({ page }, testInfo) => {
    const customActors = generateCustomMockActors(['Hero', 'Mage', 'Warrior']);
    const testDescription = testInfo.title.replace('@normal should ', '');
    
    // Define specific positions for each actor
    const positioning: MockActorPositioning = {
      fixedPositions: [
        { uid: 'mock-user-1', x: 5, y: 3, z: 0 },   // Hero
        { uid: 'mock-user-2', x: -2, y: 7, z: 0 },  // Mage
        { uid: 'mock-user-3', x: 8, y: -5, z: 0 }   // Warrior
      ]
    };
    
    console.log('🎯 Setting up custom positioning test...');
    console.log('📍 Fixed positions:', positioning.fixedPositions);
    
    // Set up world generation mock
    await page.addInitScript(getMockWorldGenerationScript(), {
      ...MOCK_WORLDS.SQUARE_24X24,
      testDescription
    });
    
    // Set up actor positioning mock
    await page.addInitScript(getMockActorPositioningScript(), positioning);
    
    // Set up WebSocket mock with custom actors
    await page.addInitScript(getMockWebSocketScriptWithActors(), {
      serverId: 'positioning-test',
      serverName: 'Custom Positioning Test Server',
      actors: customActors
    });
    
    // Navigate to the game
    await page.goto('/?e2e-test=true');
    
    // Verify mocks are set up
    const mockInfo = await page.evaluate(() => ({
      positioning: (window as any).__mockActorPositioning?.enabled || false,
      websocket: !!(window as any).__mockWebSocket || ((window as any).WebSocket?.name === 'MockWebSocket'),
      world: (window as any).__mockWorldGeneration || false
    }));
    
    console.log('✓ Mock setup verified:', mockInfo);
    
    // Wait for game initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Wait for actors to spawn
    console.log('⏳ Waiting for actors to spawn at custom positions...');
    await page.waitForTimeout(3000);
    
    // Get spawned actors
    const spawnLogs = getActorSpawnLogs(gameUtils);
    console.log(`📊 Found ${spawnLogs.length} actor spawn(s)`);
    
    // Verify all actors spawned
    expect(spawnLogs.length).toBe(customActors.length);
    
    // Verify each actor spawned at the exact expected position
    for (let i = 0; i < customActors.length; i++) {
      const expectedActor = customActors[i];
      const expectedPosition = positioning.fixedPositions![i];
      
      const actorLog = spawnLogs.find(log => log.data.username === expectedActor.username);
      expect(actorLog).toBeTruthy();
      
      if (actorLog) {
        console.log(`✓ Actor ${expectedActor.username} spawned`);
        
        // Verify exact position match
        expect(actorLog.data.x).toBe(expectedPosition.x);
        expect(actorLog.data.y).toBe(expectedPosition.y);
        expect(actorLog.data.z).toBe(expectedPosition.z || 0);
        
        console.log(`  ✅ Position matches exactly: (${actorLog.data.x}, ${actorLog.data.y}, ${actorLog.data.z}) = (${expectedPosition.x}, ${expectedPosition.y}, ${expectedPosition.z || 0})`);
      }
    }
    
    console.log(`✅ All ${customActors.length} actors spawned at exact custom positions!`);
  });

  test('@normal should cycle through custom spawn points', async ({ page }, testInfo) => {
    const customActors = generateDefaultMockActors(4);
    const testDescription = testInfo.title.replace('@normal should ', '');
    
    // Define custom spawn points to cycle through
    const positioning: MockActorPositioning = {
      customSpawnPoints: [
        { x: 1, y: 1, z: 0 },
        { x: 3, y: 3, z: 0 },
        { x: 5, y: 5, z: 0 }
      ],
      useRandomForUnspecified: false
    };
    
    console.log('🎯 Setting up spawn point cycling test...');
    console.log('📍 Custom spawn points:', positioning.customSpawnPoints);
    
    // Set up mocks
    await page.addInitScript(getMockWorldGenerationScript(), {
      ...MOCK_WORLDS.SQUARE_24X24,
      testDescription
    });
    
    await page.addInitScript(getMockActorPositioningScript(), positioning);
    
    await page.addInitScript(getMockWebSocketScriptWithActors(), {
      serverId: 'cycling-test',
      serverName: 'Spawn Point Cycling Test',
      actors: customActors
    });
    
    // Navigate to the game
    await page.goto('/?e2e-test=true');
    
    // Wait for game initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Wait for actors to spawn
    console.log('⏳ Waiting for actors to spawn at cycling positions...');
    await page.waitForTimeout(3000);
    
    // Get spawned actors
    const spawnLogs = getActorSpawnLogs(gameUtils);
    console.log(`📊 Found ${spawnLogs.length} actor spawn(s)`);
    
    // Verify all actors spawned
    expect(spawnLogs.length).toBe(customActors.length);
    
    // Sort actors by uid to ensure consistent order
    const sortedLogs = spawnLogs.sort((a, b) => a.data.uid.localeCompare(b.data.uid));
    
    // Verify each actor uses the expected spawn point (cycling through the list)
    for (let i = 0; i < sortedLogs.length; i++) {
      const actorLog = sortedLogs[i];
      const expectedSpawnPoint = positioning.customSpawnPoints![i % positioning.customSpawnPoints!.length];
      
      console.log(`✓ Actor ${actorLog.data.username} spawned at (${actorLog.data.x}, ${actorLog.data.y}, ${actorLog.data.z})`);
      
      // Verify position matches expected spawn point
      expect(actorLog.data.x).toBe(expectedSpawnPoint.x);
      expect(actorLog.data.y).toBe(expectedSpawnPoint.y);
      expect(actorLog.data.z).toBe(expectedSpawnPoint.z || 0);
      
      console.log(`  ✅ Matches spawn point ${i % positioning.customSpawnPoints!.length}: (${expectedSpawnPoint.x}, ${expectedSpawnPoint.y}, ${expectedSpawnPoint.z || 0})`);
    }
    
    console.log(`✅ All ${customActors.length} actors correctly cycled through ${positioning.customSpawnPoints!.length} spawn points!`);
  });
});
