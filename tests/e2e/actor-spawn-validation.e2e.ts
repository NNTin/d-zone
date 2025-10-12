/**
 * @file E2E tests for actor spawn coordinate validation
 * @description Tests that validate actor spawn coordinate systems and world generation
 * 
 * This test suite follows the Canvas Testing Guide approach using log-based testing
 * to verify that:
 * 1. World generation creates valid spawn positions
 * 2. Any actors that do spawn have valid coordinates within world bounds  
 * 3. No coordinate calculation errors occur (NaN, Infinity, etc.)
 * 4. Coordinate system follows game requirements (integer grid positions)
 * 
 * The tests are designed to be robust whether actors spawn automatically or not,
 * focusing on validating the underlying coordinate system integrity.
 */

import { expect, test } from '@playwright/test';
import { CanvasGameTestUtils, GameAssertions } from './utils/canvasTestUtils.js';
import {
  extractSpawnAnalysisData,
  findCoordinateErrors,
  getActorSpawnLogs,
  getLatestSpawnAnalysisData,
  getSpawnAnalysisLogs,
  getWorldGenerationData,
  validateAllSpawnedActors,
  validateBasicCoordinateTypes,
  validateCoordinatesAreIntegers,
  validateCoordinatesNotExtreme,
  validateCoordinatesNotInfinity,
  validateCoordinatesNotNaN,
  validateCoordinatesWithinBounds,
  validateNotAtBeaconPosition,
  validateNotBeaconPosition,
  validatePositionStringFormat,
  validateWorldBounds,
  validateWorldBoundsAreIntegers,
  validateZCoordinate,
  type ActorCoordinates,
  type WorldGenData
} from './utils/spawnValidationUtils.js';

test.describe('@critical Actor Spawn Validation', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
    
    // Navigate to the game
    await page.goto('/?e2e-test=true');
    
    // Verify canvas is visible before testing
    await GameAssertions.assertCanvasVisible(page);
  });

  test('@critical should have valid world generation for actor spawning', async ({ page }) => {
    // Wait for game initialization and world generation
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    
    // Wait for world generation to complete
    const worldGenEvent = await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    // Verify world generation provides valid spawn data
    expect(worldGenEvent).toBeTruthy();
    expect(worldGenEvent.data).toBeTruthy();
    
    const { spawnablePositions, mapBounds, worldRadius, totalTiles } = worldGenEvent.data as WorldGenData;
    
    // Verify world has valid spawn positions
    expect(spawnablePositions).toBeGreaterThan(0);
    expect(totalTiles).toBeGreaterThan(0);
    expect(mapBounds).toBeTruthy();
    expect(worldRadius).toBeGreaterThan(0);
    
    // Verify map bounds are reasonable using utility
    validateWorldBounds(mapBounds, worldRadius);
    
    // Verify sample spawn positions are valid coordinates
    if (worldGenEvent.data.spawnPositions) {
      const samplePositions = worldGenEvent.data.spawnPositions;
      expect(Array.isArray(samplePositions)).toBe(true);
      
      for (const pos of samplePositions) {
        validatePositionStringFormat(pos);
        validateNotBeaconPosition(pos);
      }
    }
    
    console.log(`✓ World generated with ${spawnablePositions} valid spawn positions within bounds`);
  });

  test('@critical should log detailed spawn position analysis', async ({ page }) => {
    // Wait for game initialization and world generation
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    // Check for spawn position analysis logs using utility
    const spawnAnalysisLogs = getSpawnAnalysisLogs(gameUtils);
    
    // Log debug info if no analysis found
    if (spawnAnalysisLogs.length === 0) {
      const allWorldLogs = gameUtils.getLogsByCategory('world');
      console.log('🔍 All world logs:', allWorldLogs.map(log => ({ 
        event: log.event, 
        level: log.level, 
        dataKeys: Object.keys(log.data || {}) 
      })));
    }
    
    expect(spawnAnalysisLogs.length).toBeGreaterThan(0);
    const spawnAnalysisData = extractSpawnAnalysisData(spawnAnalysisLogs)!;
    
    console.log(`📊 Spawn analysis: ${spawnAnalysisData.validSpawnPositions} valid, ${spawnAnalysisData.invalidSpawnPositions} invalid positions`);
    console.log(`📍 Sample valid positions: ${spawnAnalysisData.validPositions.slice(0, 5).join(', ')}`);
    if (spawnAnalysisData.invalidPositions.length > 0) {
      console.log(`🚫 Sample invalid positions: ${spawnAnalysisData.invalidPositions.slice(0, 3).join(', ')}`);
    }
    
    // Validate spawn analysis data
    expect(spawnAnalysisData.validSpawnPositions).toBeGreaterThan(0);
    expect(spawnAnalysisData.totalPositions).toBe(spawnAnalysisData.validSpawnPositions + spawnAnalysisData.invalidSpawnPositions);
    
    // Validate that valid positions array contains actual position strings
    expect(Array.isArray(spawnAnalysisData.validPositions)).toBe(true);
    expect(spawnAnalysisData.validPositions.length).toBeGreaterThan(0);
    
    // Check format of position strings using utility
    for (const pos of spawnAnalysisData.validPositions.slice(0, 5)) {
      validatePositionStringFormat(pos);
    }
    
    // Ensure beacon position (0:0) is not in valid spawn positions
    const hasBeaconInValid = spawnAnalysisData.validPositions.includes('0:0');
    expect(hasBeaconInValid).toBe(false);
    console.log('✓ Beacon position (0:0) correctly excluded from valid spawn positions');
    
    // Verify invalid positions include beacon if logged
    if (spawnAnalysisData.invalidPositions.length > 0) {
      const beaconInInvalid = spawnAnalysisData.invalidPositions.some(pos => pos.includes('0:0'));
      if (beaconInInvalid) {
        console.log('✓ Beacon position found in invalid positions as expected');
      }
    }
  });

  test('@critical should validate coordinates when actors do spawn', async ({ page }) => {
    // Wait for game and world initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Get world data using utility
    const worldData = getWorldGenerationData(gameUtils);
    expect(worldData).toBeTruthy();
    const { mapBounds } = worldData!;
    
    // Get spawn position analysis using utility
    const spawnAnalysisData = extractSpawnAnalysisData(getSpawnAnalysisLogs(gameUtils));
    const validSpawnPositions = spawnAnalysisData?.validPositions || [];
    const invalidSpawnPositions = spawnAnalysisData?.invalidPositions || [];
    
    if (validSpawnPositions.length > 0) {
      console.log(`📊 World has ${validSpawnPositions.length} valid spawn positions, ${invalidSpawnPositions.length} invalid positions`);
    }
    
    // Check logs from initialization
    console.log('🔍 Checking logs from initialization...');
    
    // Get actor spawn logs using utility
    const spawnLogs = getActorSpawnLogs(gameUtils);
    console.log(`📊 Actor logs found: ${spawnLogs.length}`);
    
    if (spawnLogs.length === 0) {
      console.log('ℹ No actors spawned automatically - test validates coordinate format requirements');
      
      // Test the coordinate validation logic by checking that the world bounds are reasonable
      validateWorldBoundsAreIntegers(mapBounds);
      
      console.log('✓ World bounds are valid integers for coordinate system');
      return;
    }
    
    // If actors did spawn, validate their coordinates using utilities
    console.log(`Found ${spawnLogs.length} actor spawn(s) to validate`);
    
    for (const spawnLog of spawnLogs) {
      const coords: ActorCoordinates = {
        uid: spawnLog.data.uid,
        username: spawnLog.data.username,
        x: spawnLog.data.x,
        y: spawnLog.data.y,
        z: spawnLog.data.z
      };
      
      // Use validation utilities
      validateBasicCoordinateTypes(coords);
      validateCoordinatesNotNaN(coords);
      validateCoordinatesAreIntegers(coords);
      validateCoordinatesWithinBounds(coords, mapBounds);
      validateZCoordinate(coords.z);
      validateNotAtBeaconPosition(coords);
      
      // Check if actor spawned in a position that was marked as valid
      if (validSpawnPositions.length > 0) {
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
      } else {
        console.log(`⚠️  No spawn position analysis data available for ${coords.username} at (${coords.x}, ${coords.y}, ${coords.z})`);
      }
      
      console.log(`✓ Actor ${coords.username} (${coords.uid}) has valid coordinates: (${coords.x}, ${coords.y}, ${coords.z})`);
    }
  });

  test('@critical should detect coordinate errors if they occur', async ({ page }) => {
    // Wait for game and world initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Monitor logs for coordinate-related errors
    gameUtils.clearLogs();
    await page.waitForTimeout(15000); // Wait longer for potential issues
    
    // Check for coordinate-related errors using utility
    const coordinateErrors = findCoordinateErrors(gameUtils);
    
    // Should have no coordinate-related errors
    expect(coordinateErrors.length).toBe(0);
    
    // Also check for any actor spawn events and validate them
    const spawnLogs = getActorSpawnLogs(gameUtils);
    
    // If any actors spawned, verify they have clean coordinate data
    for (const spawnLog of spawnLogs) {
      const coords: ActorCoordinates = {
        uid: spawnLog.data.uid,
        username: spawnLog.data.username,
        x: spawnLog.data.x,
        y: spawnLog.data.y,
        z: spawnLog.data.z
      };
      
      // Use validation utilities for edge cases
      validateCoordinatesNotInfinity(coords);
      validateCoordinatesNotExtreme(coords);
    }
    
    if (spawnLogs.length > 0) {
      console.log(`✓ Validated ${spawnLogs.length} actors with clean coordinate data, no errors detected`);
    } else {
      console.log('✓ No coordinate errors detected during monitoring period');
    }
  });

  test('@critical should validate actor spawning when switching servers', async ({ page }) => {
    // Wait for initial game and world initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    console.log('🔍 Phase 1: Validating initial server actors...');
    
    // Get initial actor spawns from the default server
    const initialActorLogs = getActorSpawnLogs(gameUtils);
    console.log(`📊 Initial server spawned ${initialActorLogs.length} actors`);
    
    // Validate initial actors if any spawned using basic validation
    for (const log of initialActorLogs) {
      const coords: ActorCoordinates = {
        uid: log.data.uid,
        username: log.data.username,
        x: log.data.x,
        y: log.data.y,
        z: log.data.z
      };
      
      validateBasicCoordinateTypes(coords);
      console.log(`✓ Initial actor ${coords.username} at (${coords.x}, ${coords.y}, ${coords.z})`);
    }
    
    console.log('🔄 Phase 2: Switching to "My Repos" server...');
    
    // First, let's check what servers are available
    const availableServers = await page.evaluate(() => {
      const game = (window as any).game;
      return game.servers ? Object.keys(game.servers).map(key => ({
        key,
        id: game.servers[key].id,
        name: game.servers[key].name,
        passworded: game.servers[key].passworded
      })) : [];
    });
    
    console.log('📊 Available servers:', availableServers);
    
    // Clear previous logs to focus on server switch
    gameUtils.clearLogs();
    
    // Switch to "My Repos" server by calling the global joinServer function
    let targetServer = 'repos'; // Use the ID, not the name
    const serverExists = availableServers.some(s => s.id === targetServer);
    
    if (!serverExists) {
      // Fallback to any available server that's not the current one
      const currentServer = await page.evaluate(() => (window as any).game.server);
      const alternativeServer = availableServers.find(s => s.id !== currentServer);
      
      if (alternativeServer) {
        targetServer = alternativeServer.id;
        console.log(`📍 "repos" server not found, using "${targetServer}" instead`);
      } else {
        console.log('⚠️  No alternative servers available for testing');
        // Still try the original target to see what happens
        targetServer = 'repos';
      }
    } else {
      console.log(`✓ Found "My Repos" server with ID: ${targetServer}`);
    }
    
    console.log(`🔗 Attempting to join server: "${targetServer}"`);
    
    await page.evaluate((serverId) => {
      // Access the joinServer function from the global scope
      const joinServer = (window as any).joinServer;
      if (joinServer) {
        joinServer({ id: serverId });
      } else {
        throw new Error('joinServer function not available');
      }
    }, targetServer);
    
    // Wait for server switch, world regeneration, and new actor spawning
    console.log('⏳ Waiting for server switch and new world generation...');
    await page.waitForTimeout(15000);
    
    // Wait for new world generation after server switch
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Check for new actor spawns after server switch
    const newActorLogs = getActorSpawnLogs(gameUtils);
    
    console.log(`📊 "${availableServers.find(s => s.id === targetServer)?.name || targetServer}" server spawned ${newActorLogs.length} new actors`);
    
    if (newActorLogs.length === 0) {
      console.log('ℹ No new actors spawned on "My Repos" server');
      // Still validate that the server switch occurred
      const websocketLogs = gameUtils.getLogsByCategory('websocket');
      const serverJoinLogs = websocketLogs.filter(log => 
        log.event === 'server_joined' || 
        (log.data && typeof log.data === 'object' && 'serverId' in log.data)
      );
      
      if (serverJoinLogs.length > 0) {
        console.log('✓ Server switch was attempted');
      }
    } else {
      console.log(`🔍 Validating ${newActorLogs.length} new actors from server switch...`);
      
      // Get world data and spawn analysis for the new world
      const newWorldData = getWorldGenerationData(gameUtils);
      const newSpawnAnalysisData = getLatestSpawnAnalysisData(gameUtils);
      
      const newValidSpawnPositions = newSpawnAnalysisData?.validPositions || [];
      
      if (newValidSpawnPositions.length > 0) {
        console.log(`📊 New world has ${newValidSpawnPositions.length} valid spawn positions`);
      }
      
      // Use the comprehensive validation utility
      const validationResults = validateAllSpawnedActors(
        gameUtils,
        newWorldData!.mapBounds,
        newValidSpawnPositions
      );
      
      console.log(`📊 Coordinate validation summary: ${validationResults.validActors} valid, ${validationResults.invalidActors} invalid actors`);
      
      // Log any errors found
      if (validationResults.errors.length > 0) {
        for (const error of validationResults.errors) {
          console.log(`❌ Actor ${error.actor} validation errors:`, error.errors);
        }
      }
      
      // All actors should have valid coordinates - the test should fail if any don't
      expect(validationResults.invalidActors).toBe(0);
      
      // Ensure at least some actors were processed
      expect(validationResults.totalActors).toBeGreaterThan(0);
    }
  });
});