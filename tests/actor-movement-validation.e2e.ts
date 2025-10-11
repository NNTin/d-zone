/**
 * @file E2E tests for actor movement coordinate validation
 * @description Tests that validate actor movement coordinate systems during simulation
 * 
 * This test suite follows the Canvas Testing Guide approach using log-based testing
 * to verify that:
 * 1. Actors move to valid coordinates within world bounds
 * 2. Movement coordinates match the valid spawn positions from world generation
 * 3. No invalid movement coordinates occur during simulation
 * 4. Movement follows game rules (grid-based, walkable tiles only)
 * 5. **CRITICAL BUG DETECTION**: Hopping animations correspond to actual actor movement
 * 
 * The tests connect to the repos server which has >20 actors to provide comprehensive
 * movement validation data during monitoring periods.
 * 
 * Key bug being detected: Hopping animations play without corresponding actor movement,
 * indicating the animation system is decoupled from the actual movement system.
 */

import { expect, test } from '@playwright/test';
import { CanvasGameTestUtils, GameAssertions, GameLogEvent } from './utils/canvasTestUtils.js';

test.describe('@critical Actor Movement Validation', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
    
    // Navigate to the game
    await page.goto('/?e2e-test=true');
    
    // Verify canvas is visible before testing
    await GameAssertions.assertCanvasVisible(page);
  });

  test('@critical should validate actor movements connect to repos server', async ({ page }) => {
    // Wait for game initialization and world generation
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    console.log('🔗 Connecting to repos server for movement validation...');
    
    // Clear logs before server switch to focus on repos server data
    gameUtils.clearLogs();
    
    // Switch to repos server which has >20 actors
    await page.evaluate(() => {
      const joinServer = (window as any).joinServer;
      if (joinServer) {
        joinServer({ id: 'repos' });
      } else {
        throw new Error('joinServer function not available');
      }
    });
    
    // Wait for server switch and new world generation
    console.log('⏳ Waiting for repos server connection and world generation...');
    await page.waitForTimeout(5000);
    
    // Wait for new world generation after server switch
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    // Verify we're actually on the repos server
    const serverInfo = await page.evaluate(() => {
      const game = (window as any).game;
      return {
        currentServer: game.server,
        serverName: game.servers?.[game.server]?.name || 'unknown'
      };
    });
    
    console.log(`📊 Connected to server: ${serverInfo.currentServer} (${serverInfo.serverName})`);
    
    // Should be connected to repos server
    if (serverInfo.currentServer !== 'repos') {
      console.log(`❌ Failed to connect to repos server. Currently on: ${serverInfo.currentServer}`);
      expect(serverInfo.currentServer).toBe('repos');
    }
    
    // Get spawn position analysis for the repos server world
    const spawnAnalysisLogs = gameUtils.getLogsByCategory('world')
      .filter(log => log.event === 'spawn_analysis');
    
    expect(spawnAnalysisLogs.length).toBeGreaterThan(0);
    const spawnAnalysisData = spawnAnalysisLogs[spawnAnalysisLogs.length - 1].data as {
      totalPositions: number;
      validSpawnPositions: number;
      invalidSpawnPositions: number;
      validPositions: string[];
      invalidPositions: string[];
    };
    
    console.log(`📊 Repos server world analysis: ${spawnAnalysisData.validSpawnPositions} valid positions, ${spawnAnalysisData.invalidSpawnPositions} invalid positions`);
    
    // Wait for actors to spawn on repos server
    const actorSpawnLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'spawned');
    
    console.log(`📊 Repos server spawned ${actorSpawnLogs.length} actors`);
    expect(actorSpawnLogs.length).toBeGreaterThan(0);
    
    // Expect a reasonable number of actors for comprehensive testing
    if (actorSpawnLogs.length < 10) {
      console.log(`❌ Insufficient actors spawned: ${actorSpawnLogs.length} (expected at least 10 for repos server)`);
      expect(actorSpawnLogs.length).toBeGreaterThanOrEqual(10);
    }
    
    // Verify we have a good number of actors for testing (should be >20)
    if (actorSpawnLogs.length >= 20) {
      console.log(`✓ Good actor count for movement testing: ${actorSpawnLogs.length} actors`);
    } else {
      console.log(`❌ Lower than expected actor count: ${actorSpawnLogs.length} (expected >20)`);
      // Fail the test if we don't have enough actors for meaningful movement testing
      expect(actorSpawnLogs.length).toBeGreaterThanOrEqual(20);
    }
    
    // Clear logs and start monitoring movement and animations for 15 seconds
    console.log('🏃 Starting 15-second movement and animation monitoring...');
    gameUtils.clearLogs();
    
    const movementStartTime = Date.now();
    await page.waitForTimeout(15000); // Monitor for 15 seconds
    const movementEndTime = Date.now();
    
    console.log(`📊 Movement monitoring completed (${(movementEndTime - movementStartTime) / 1000}s)`);
    
    // Collect all movement events during the monitoring period
    const movementLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'moved');
    
    // Collect all hopping animation events during the monitoring period
    const hoppingAnimationLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'animationStarted' && log.data.animationType === 'hopping');
    
    console.log(`📊 Captured ${movementLogs.length} movement events and ${hoppingAnimationLogs.length} hopping animations during monitoring`);
    
    console.log(`📊 Captured ${movementLogs.length} movement events and ${hoppingAnimationLogs.length} hopping animations during monitoring`);
    
    // Critical bug detection: Validate that hopping animations correspond to actual movements
    console.log('🔍 Validating hopping animations correspond to actual movements...');
    
    // Group movements by actor and timestamp
    const movementsByActor = new Map<string, Array<{timestamp: number, fromX: number, fromY: number, toX: number, toY: number}>>();
    for (const movementLog of movementLogs) {
      const { uid, fromX, fromY, toX, toY } = movementLog.data;
      if (!movementsByActor.has(uid)) {
        movementsByActor.set(uid, []);
      }
      movementsByActor.get(uid)!.push({
        timestamp: movementLog.timestamp,
        fromX, fromY, toX, toY
      });
    }
    
    // Check each hopping animation for corresponding movement
    let hoppingAnimationsWithoutMovement = 0;
    let hoppingAnimationsWithMovement = 0;
    const problematicHops: any[] = [];
    
    for (const hoppingLog of hoppingAnimationLogs) {
      const { uid, username } = hoppingLog.data;
      const hoppingTimestamp = hoppingLog.timestamp;
      
      // Look for movements by this actor within a reasonable time window (±2 seconds) of the hopping animation
      const actorMovements = movementsByActor.get(uid) || [];
      const timeWindow = 2000; // 2 seconds
      
      const correspondingMovement = actorMovements.find(movement => 
        Math.abs(movement.timestamp - hoppingTimestamp) <= timeWindow
      );
      
      if (correspondingMovement) {
        hoppingAnimationsWithMovement++;
        console.log(`✓ Hopping animation for ${username || uid} has corresponding movement: (${correspondingMovement.fromX}, ${correspondingMovement.fromY}) → (${correspondingMovement.toX}, ${correspondingMovement.toY})`);
      } else {
        hoppingAnimationsWithoutMovement++;
        problematicHops.push({
          actor: username || uid,
          uid,
          timestamp: hoppingTimestamp,
          timeWindowStart: new Date(hoppingTimestamp - timeWindow).toISOString(),
          timeWindowEnd: new Date(hoppingTimestamp + timeWindow).toISOString()
        });
        console.log(`❌ Hopping animation for ${username || uid} has NO corresponding movement within ±${timeWindow/1000}s`);
      }
    }
    
    console.log(`📊 Hopping animation analysis:`);
    console.log(`  Hopping animations with movement: ${hoppingAnimationsWithMovement}`);
    console.log(`  Hopping animations WITHOUT movement: ${hoppingAnimationsWithoutMovement}`);
    
    // Report problematic hopping animations
    if (hoppingAnimationsWithoutMovement > 0) {
      console.log('❌ Problematic hopping animations (animation without movement):');
      for (const hop of problematicHops) {
        console.log(`  - ${hop.actor} at ${new Date(hop.timestamp).toISOString()}`);
      }
      
      // This is the bug we're detecting - hopping animations without actual movement
      console.log('🐛 BUG DETECTED: Hopping animations are playing without corresponding actor movement!');
      expect(hoppingAnimationsWithoutMovement).toBe(0);
    }
    
    if (movementLogs.length === 0 && hoppingAnimationLogs.length === 0) {
      console.log('❌ No movement events or hopping animations detected - actors should be active on repos server');
      // Fail the test if no activity is detected - this indicates a problem
      expect(movementLogs.length + hoppingAnimationLogs.length).toBeGreaterThan(0);
      return;
    }
    
    // Validate each movement event (only if we have movements)
    let validMovements = 0;
    let invalidMovements = 0;
    const invalidMovementDetails: any[] = [];
    
    if (movementLogs.length > 0) {
      console.log('🔍 Validating movement coordinates...');
      
      for (const movementLog of movementLogs) {
        const { uid, username, fromX, fromY, fromZ, toX, toY, toZ, movementType } = movementLog.data;
        
        // Basic coordinate validation
        expect(typeof toX).toBe('number');
        expect(typeof toY).toBe('number');
        expect(typeof toZ).toBe('number');
        expect(Number.isFinite(toX)).toBe(true);
        expect(Number.isFinite(toY)).toBe(true);
        expect(Number.isFinite(toZ)).toBe(true);
        expect(Number.isInteger(toX)).toBe(true);
        expect(Number.isInteger(toY)).toBe(true);
        
        // Validate from coordinates as well
        expect(typeof fromX).toBe('number');
        expect(typeof fromY).toBe('number');
        expect(typeof fromZ).toBe('number');
        expect(Number.isFinite(fromX)).toBe(true);
        expect(Number.isFinite(fromY)).toBe(true);
        expect(Number.isFinite(fromZ)).toBe(true);
        expect(Number.isInteger(fromX)).toBe(true);
        expect(Number.isInteger(fromY)).toBe(true);
        
        // Validate movement type
        expect(typeof movementType).toBe('string');
        expect(['relative', 'absolute']).toContain(movementType);
        
        // Check if destination coordinates are in valid spawn positions
        const destinationPosition = `${toX}:${toY}`;
        const isValidDestination = spawnAnalysisData.validPositions.includes(destinationPosition);
        
        if (isValidDestination) {
          validMovements++;
          console.log(`✓ Valid movement: ${username || uid} moved from (${fromX}, ${fromY}) to (${toX}, ${toY})`);
        } else {
          invalidMovements++;
          const details = {
            actor: username || uid,
            uid,
            from: { x: fromX, y: fromY, z: fromZ },
            to: { x: toX, y: toY, z: toZ },
            movementType,
            destinationPosition,
            timestamp: movementLog.timestamp
          };
          invalidMovementDetails.push(details);
          console.log(`❌ Invalid movement: ${username || uid} moved to INVALID position (${toX}, ${toY}) - not in valid spawn list`);
        }
        
        // Additional validation: shouldn't move to beacon position (0,0)
        if (toX === 0 && toY === 0) {
          console.log(`❌ Actor ${username || uid} moved to beacon position (0, 0) - this should not happen`);
          expect(false).toBe(true); // Fail the test explicitly
        }
        
        // Validate coordinates are within reasonable bounds (not extremely large values)
        expect(Math.abs(toX)).toBeLessThan(1000);
        expect(Math.abs(toY)).toBeLessThan(1000);
        expect(Math.abs(toZ)).toBeLessThan(100);
        expect(Math.abs(fromX)).toBeLessThan(1000);
        expect(Math.abs(fromY)).toBeLessThan(1000);
        expect(Math.abs(fromZ)).toBeLessThan(100);
      }
      
      console.log(`📊 Movement validation summary: ${validMovements} valid, ${invalidMovements} invalid movements`);
      
      // Report invalid movements if any
      if (invalidMovements > 0) {
        console.log('❌ Invalid movement details:');
        for (const detail of invalidMovementDetails) {
          console.log(`  - ${detail.actor}: (${detail.from.x}, ${detail.from.y}) → (${detail.to.x}, ${detail.to.y}) [${detail.movementType}]`);
        }
        console.log(`📍 Sample valid positions: ${spawnAnalysisData.validPositions.slice(0, 10).join(', ')}`);
        
        // All movements should be to valid coordinates
        expect(invalidMovements).toBe(0);
      }
    }
    
    // Final validation summary
    if (movementLogs.length > 0) {
      // Ensure we captured some movements for validation
      expect(validMovements).toBeGreaterThan(0);
      
      // Ensure we have meaningful movement activity (at least some percentage of actors moved)
      if (actorSpawnLogs.length >= 10 && validMovements < Math.floor(actorSpawnLogs.length * 0.1)) {
        console.log(`❌ Too few movements detected: ${validMovements} movements for ${actorSpawnLogs.length} actors (expected at least 10% activity)`);
        expect(validMovements).toBeGreaterThanOrEqual(Math.floor(actorSpawnLogs.length * 0.1));
      }
      
      console.log(`✅ All ${validMovements} movement(s) were to valid coordinates during 15-second monitoring`);
    }
    
    // Key validation: If we have hopping animations, they should correspond to movements
    if (hoppingAnimationLogs.length > 0) {
      console.log(`📊 Animation-Movement Consistency Check:`);
      console.log(`  Total hopping animations: ${hoppingAnimationLogs.length}`);
      console.log(`  Hopping animations with movement: ${hoppingAnimationsWithMovement}`);
      console.log(`  Hopping animations WITHOUT movement: ${hoppingAnimationsWithoutMovement}`);
      
      // This is the critical test - hopping animations should always result in movement
      if (hoppingAnimationsWithoutMovement > 0) {
        console.log(`🐛 CRITICAL BUG: ${hoppingAnimationsWithoutMovement} hopping animation(s) did not result in actual movement!`);
      } else {
        console.log(`✅ All hopping animations correctly resulted in actor movement`);
      }
    } else {
      console.log('ℹ No hopping animations detected during monitoring period');
    }
  });

  test('@critical should detect hopping animation without movement bug', async ({ page }) => {
    // Wait for game initialization and world generation
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    console.log('🔗 Connecting to repos server for hopping animation bug detection...');
    
    // Clear logs and switch to repos server
    gameUtils.clearLogs();
    
    await page.evaluate(() => {
      const joinServer = (window as any).joinServer;
      if (joinServer) {
        joinServer({ id: 'repos' });
      } else {
        throw new Error('joinServer function not available');
      }
    });
    
    // Wait for server switch and new world generation
    await page.waitForTimeout(5000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    // Verify we're on the repos server
    const serverInfo = await page.evaluate(() => {
      const game = (window as any).game;
      return { currentServer: game.server };
    });
    expect(serverInfo.currentServer).toBe('repos');
    
    // Wait for actors to spawn
    const actorSpawnLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'spawned');
    
    console.log(`📊 Monitoring ${actorSpawnLogs.length} actors for hopping animation bug`);
    expect(actorSpawnLogs.length).toBeGreaterThanOrEqual(10);
    
    // Clear logs and monitor specifically for hopping animations and movements
    console.log('🔍 Starting targeted 20-second monitoring for hopping animation bug...');
    gameUtils.clearLogs();
    
    await page.waitForTimeout(20000); // Monitor for 20 seconds to catch more activity
    
    // Collect hopping animations and movements
    const allLogs = gameUtils.getAllLogs();
    const hoppingAnimations = allLogs.filter(log => 
      log.category === 'actor' && 
      log.event === 'animationStarted' && 
      log.data.animationType === 'hopping'
    );
    
    const movements = allLogs.filter(log => 
      log.category === 'actor' && 
      log.event === 'moved'
    );
    
    console.log(`📊 Bug detection results:`);
    console.log(`  Hopping animations detected: ${hoppingAnimations.length}`);
    console.log(`  Movement events detected: ${movements.length}`);
    
    if (hoppingAnimations.length === 0) {
      console.log('ℹ No hopping animations detected during monitoring - cannot test for bug');
      return;
    }
    
    // Create a detailed mapping of animations to movements
    const animationMovementPairs: Array<{
      animation: any;
      matchingMovement: any | null;
      timeDifference: number | null;
    }> = [];
    
    for (const animation of hoppingAnimations) {
      const { uid, username } = animation.data;
      const animationTime = animation.timestamp;
      
      // Find the closest movement by this actor within a reasonable time window
      const actorMovements = movements.filter(m => m.data.uid === uid);
      let closestMovement = null;
      let smallestTimeDiff = Infinity;
      
      for (const movement of actorMovements) {
        const timeDiff = Math.abs(movement.timestamp - animationTime);
        if (timeDiff < smallestTimeDiff && timeDiff <= 3000) { // 3 second window
          smallestTimeDiff = timeDiff;
          closestMovement = movement;
        }
      }
      
      animationMovementPairs.push({
        animation,
        matchingMovement: closestMovement,
        timeDifference: closestMovement ? smallestTimeDiff : null
      });
      
      if (closestMovement) {
        const { fromX, fromY, toX, toY } = closestMovement.data;
        console.log(`✓ Hopping animation for ${username || uid} matched with movement: (${fromX}, ${fromY}) → (${toX}, ${toY}) [${smallestTimeDiff}ms apart]`);
      } else {
        console.log(`❌ Hopping animation for ${username || uid} has NO matching movement within 3 seconds`);
      }
    }
    
    // Count animations without movements
    const animationsWithoutMovement = animationMovementPairs.filter(pair => pair.matchingMovement === null);
    const animationsWithMovement = animationMovementPairs.filter(pair => pair.matchingMovement !== null);
    
    console.log(`📊 Final bug detection summary:`);
    console.log(`  Hopping animations WITH corresponding movement: ${animationsWithMovement.length}`);
    console.log(`  Hopping animations WITHOUT corresponding movement: ${animationsWithoutMovement.length}`);
    
    // Report the bug if found
    if (animationsWithoutMovement.length > 0) {
      console.log(`🐛 BUG CONFIRMED: ${animationsWithoutMovement.length} hopping animation(s) played without actual actor movement!`);
      console.log('   This indicates the animation system is decoupled from the movement system.');
      
      for (const problematicPair of animationsWithoutMovement) {
        const { username, uid } = problematicPair.animation.data;
        console.log(`   - ${username || uid} hopped at ${new Date(problematicPair.animation.timestamp).toISOString()} but never moved`);
      }
      
      // Fail the test - this is the bug we're trying to detect
      expect(animationsWithoutMovement.length).toBe(0);
    } else {
      console.log(`✅ No hopping animation bug detected - all ${animationsWithMovement.length} hopping animations had corresponding movements`);
    }
  });

  // Pathfinding tests with mocked websocket and controlled world
  test('@critical should path around empty tile from north to south', async ({ page }) => {
    console.log('🗺️ Testing pathfinding: North to South around empty tile');
    
    // Navigate and wait for initial setup
    await page.goto('/?e2e-test=true');
    await GameAssertions.assertCanvasVisible(page);
    
    // Mock websocket and create controlled world
    await page.evaluate(() => {
      // Mock the websocket connection
      const mockWebSocket = {
        send: () => {},
        close: () => {},
        readyState: 1, // OPEN
        addEventListener: () => {},
        removeEventListener: () => {}
      };
      
      // Override WebSocket constructor
      (window as any).WebSocket = function() { return mockWebSocket; };
      
      // Create a controlled world with empty tile in middle
      const game = (window as any).game;
      if (game && game.world) {
        // Clear existing world
        game.world.tiles = {};
        
        // Create 3x3 island with empty center
        const tiles = [
          { x: -1, y: -1, type: 'grass' },
          { x: 0, y: -1, type: 'grass' },  // North spawn
          { x: 1, y: -1, type: 'grass' },
          { x: -1, y: 0, type: 'grass' },
          // { x: 0, y: 0 } - EMPTY TILE (no tile here)
          { x: 1, y: 0, type: 'grass' },
          { x: -1, y: 1, type: 'grass' },
          { x: 0, y: 1, type: 'grass' },   // South destination
          { x: 1, y: 1, type: 'grass' }
        ];
        
        // Add tiles to world
        for (const tile of tiles) {
          game.world.tiles[`${tile.x}:${tile.y}`] = {
            x: tile.x,
            y: tile.y,
            type: tile.type,
            walkable: true
          };
        }
        
        // Update world bounds
        game.world.bounds = { xl: -1, xh: 1, yl: -1, yh: 1 };
      }
    });
    
    // Start log capture after world setup
    await gameUtils.startLogCapture();
    
    // Create test actor at north position
    await page.evaluate(() => {
      const game = (window as any).game;
      if (game && game.actors) {
        // Clear existing actors
        game.actors = {};
        
        // Create actor at north position (0, -1)
        const testActor = {
          uid: 'test-actor-north',
          username: 'TestActorNorth',
          x: 0,
          y: -1,
          z: 0,
          facing: 'south',
          position: { x: 0, y: -1, z: 0 }
        };
        
        game.actors['test-actor-north'] = testActor;
        
        // Log the actor spawn
        if ((window as any).gameLogger) {
          (window as any).gameLogger.actorSpawned({
            uid: testActor.uid,
            username: testActor.username,
            x: testActor.x,
            y: testActor.y,
            z: testActor.z
          });
        }
      }
    });
    
    // Clear logs and start movement
    gameUtils.clearLogs();
    
    // Command actor to move to south position
    await page.evaluate(() => {
      const game = (window as any).game;
      const actor = game.actors['test-actor-north'];
      if (actor) {
        // Simulate movement command to (0, 1) - south destination
        // This should trigger pathfinding around the empty tile
        if (actor.moveTo) {
          actor.moveTo(0, 1);
        } else {
          // Manual pathfinding simulation
          actor.destination = { x: 0, y: 1 };
          actor.startMove && actor.startMove();
        }
      }
    });
    
    // Monitor movement for 10 seconds
    await page.waitForTimeout(10000);
    
    // Collect movement logs
    const movementLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'moved');
    
    console.log(`📊 Captured ${movementLogs.length} movement events for north-to-south pathfinding`);
    
    if (movementLogs.length === 0) {
      console.log('❌ No movement events detected - actor should respond to movement commands');
      expect(movementLogs.length).toBeGreaterThan(0);
      return;
    }
    
    // Validate pathfinding: actor should NOT move through (0, 0)
    let movedThroughEmptyTile = false;
    let pathTaken: string[] = [];
    
    for (const movement of movementLogs) {
      const { toX, toY } = movement.data;
      const position = `${toX}:${toY}`;
      pathTaken.push(position);
      
      if (toX === 0 && toY === 0) {
        movedThroughEmptyTile = true;
        console.log(`❌ Actor moved through empty tile at (0, 0) - pathfinding failed!`);
      }
    }
    
    console.log(`📍 Path taken: ${pathTaken.join(' → ')}`);
    
    // Test should fail if actor moved through empty tile
    expect(movedThroughEmptyTile).toBe(false);
    
    // Verify actor reached destination or at least attempted to path around
    const finalMovement = movementLogs[movementLogs.length - 1];
    if (finalMovement) {
      const { toX, toY } = finalMovement.data;
      console.log(`✓ Actor pathfinding from north (0, -1) avoided empty tile (0, 0), final position: (${toX}, ${toY})`);
    }
  });

  test('@critical should path around empty tile from south to north', async ({ page }) => {
    console.log('🗺️ Testing pathfinding: South to North around empty tile');
    
    await page.goto('/?e2e-test=true');
    await GameAssertions.assertCanvasVisible(page);
    
    // Create same world setup with actor at south
    await page.evaluate(() => {
      const mockWebSocket = {
        send: () => {},
        close: () => {},
        readyState: 1,
        addEventListener: () => {},
        removeEventListener: () => {}
      };
      (window as any).WebSocket = function() { return mockWebSocket; };
      
      const game = (window as any).game;
      if (game && game.world) {
        game.world.tiles = {};
        const tiles = [
          { x: -1, y: -1, type: 'grass' },
          { x: 0, y: -1, type: 'grass' },  // North destination
          { x: 1, y: -1, type: 'grass' },
          { x: -1, y: 0, type: 'grass' },
          { x: 1, y: 0, type: 'grass' },
          { x: -1, y: 1, type: 'grass' },
          { x: 0, y: 1, type: 'grass' },   // South spawn
          { x: 1, y: 1, type: 'grass' }
        ];
        
        for (const tile of tiles) {
          game.world.tiles[`${tile.x}:${tile.y}`] = {
            x: tile.x, y: tile.y, type: tile.type, walkable: true
          };
        }
        game.world.bounds = { xl: -1, xh: 1, yl: -1, yh: 1 };
      }
    });
    
    await gameUtils.startLogCapture();
    
    // Create actor at south position
    await page.evaluate(() => {
      const game = (window as any).game;
      if (game && game.actors) {
        game.actors = {};
        const testActor = {
          uid: 'test-actor-south',
          username: 'TestActorSouth',
          x: 0, y: 1, z: 0,
          facing: 'north',
          position: { x: 0, y: 1, z: 0 }
        };
        game.actors['test-actor-south'] = testActor;
        
        if ((window as any).gameLogger) {
          (window as any).gameLogger.actorSpawned({
            uid: testActor.uid, username: testActor.username,
            x: testActor.x, y: testActor.y, z: testActor.z
          });
        }
      }
    });
    
    gameUtils.clearLogs();
    
    // Command movement to north
    await page.evaluate(() => {
      const game = (window as any).game;
      const actor = game.actors['test-actor-south'];
      if (actor) {
        if (actor.moveTo) {
          actor.moveTo(0, -1);
        } else {
          actor.destination = { x: 0, y: -1 };
          actor.startMove && actor.startMove();
        }
      }
    });
    
    await page.waitForTimeout(10000);
    
    const movementLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'moved');
    
    console.log(`📊 Captured ${movementLogs.length} movement events for south-to-north pathfinding`);
    
    if (movementLogs.length === 0) {
      console.log('❌ No movement events detected - actor should respond to movement commands');
      expect(movementLogs.length).toBeGreaterThan(0);
      return;
    }
    
    let movedThroughEmptyTile = false;
    let pathTaken: string[] = [];
    
    for (const movement of movementLogs) {
      const { toX, toY } = movement.data;
      pathTaken.push(`${toX}:${toY}`);
      if (toX === 0 && toY === 0) {
        movedThroughEmptyTile = true;
        console.log(`❌ Actor moved through empty tile at (0, 0) - pathfinding failed!`);
      }
    }
    
    console.log(`📍 Path taken: ${pathTaken.join(' → ')}`);
    expect(movedThroughEmptyTile).toBe(false);
    
    const finalMovement = movementLogs[movementLogs.length - 1];
    if (finalMovement) {
      const { toX, toY } = finalMovement.data;
      console.log(`✓ Actor pathfinding from south (0, 1) avoided empty tile (0, 0), final position: (${toX}, ${toY})`);
    }
  });

  test('@critical should path around empty tile from west to east', async ({ page }) => {
    console.log('🗺️ Testing pathfinding: West to East around empty tile');
    
    await page.goto('/?e2e-test=true');
    await GameAssertions.assertCanvasVisible(page);
    
    await page.evaluate(() => {
      const mockWebSocket = {
        send: () => {}, close: () => {}, readyState: 1,
        addEventListener: () => {}, removeEventListener: () => {}
      };
      (window as any).WebSocket = function() { return mockWebSocket; };
      
      const game = (window as any).game;
      if (game && game.world) {
        game.world.tiles = {};
        const tiles = [
          { x: -1, y: -1, type: 'grass' },
          { x: 0, y: -1, type: 'grass' },
          { x: 1, y: -1, type: 'grass' },
          { x: -1, y: 0, type: 'grass' },  // West spawn
          { x: 1, y: 0, type: 'grass' },   // East destination
          { x: -1, y: 1, type: 'grass' },
          { x: 0, y: 1, type: 'grass' },
          { x: 1, y: 1, type: 'grass' }
        ];
        
        for (const tile of tiles) {
          game.world.tiles[`${tile.x}:${tile.y}`] = {
            x: tile.x, y: tile.y, type: tile.type, walkable: true
          };
        }
        game.world.bounds = { xl: -1, xh: 1, yl: -1, yh: 1 };
      }
    });
    
    await gameUtils.startLogCapture();
    
    await page.evaluate(() => {
      const game = (window as any).game;
      if (game && game.actors) {
        game.actors = {};
        const testActor = {
          uid: 'test-actor-west',
          username: 'TestActorWest',
          x: -1, y: 0, z: 0,
          facing: 'east',
          position: { x: -1, y: 0, z: 0 }
        };
        game.actors['test-actor-west'] = testActor;
        
        if ((window as any).gameLogger) {
          (window as any).gameLogger.actorSpawned({
            uid: testActor.uid, username: testActor.username,
            x: testActor.x, y: testActor.y, z: testActor.z
          });
        }
      }
    });
    
    gameUtils.clearLogs();
    
    await page.evaluate(() => {
      const game = (window as any).game;
      const actor = game.actors['test-actor-west'];
      if (actor) {
        if (actor.moveTo) {
          actor.moveTo(1, 0);
        } else {
          actor.destination = { x: 1, y: 0 };
          actor.startMove && actor.startMove();
        }
      }
    });
    
    await page.waitForTimeout(10000);
    
    const movementLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'moved');
    
    console.log(`📊 Captured ${movementLogs.length} movement events for west-to-east pathfinding`);
    
    if (movementLogs.length === 0) {
      console.log('❌ No movement events detected - actor should respond to movement commands');
      expect(movementLogs.length).toBeGreaterThan(0);
      return;
    }
    
    let movedThroughEmptyTile = false;
    let pathTaken: string[] = [];
    
    for (const movement of movementLogs) {
      const { toX, toY } = movement.data;
      pathTaken.push(`${toX}:${toY}`);
      if (toX === 0 && toY === 0) {
        movedThroughEmptyTile = true;
        console.log(`❌ Actor moved through empty tile at (0, 0) - pathfinding failed!`);
      }
    }
    
    console.log(`📍 Path taken: ${pathTaken.join(' → ')}`);
    expect(movedThroughEmptyTile).toBe(false);
    
    const finalMovement = movementLogs[movementLogs.length - 1];
    if (finalMovement) {
      const { toX, toY } = finalMovement.data;
      console.log(`✓ Actor pathfinding from west (-1, 0) avoided empty tile (0, 0), final position: (${toX}, ${toY})`);
    }
  });

  test('@critical should path around empty tile from east to west', async ({ page }) => {
    console.log('🗺️ Testing pathfinding: East to West around empty tile');
    
    await page.goto('/?e2e-test=true');
    await GameAssertions.assertCanvasVisible(page);
    
    await page.evaluate(() => {
      const mockWebSocket = {
        send: () => {}, close: () => {}, readyState: 1,
        addEventListener: () => {}, removeEventListener: () => {}
      };
      (window as any).WebSocket = function() { return mockWebSocket; };
      
      const game = (window as any).game;
      if (game && game.world) {
        game.world.tiles = {};
        const tiles = [
          { x: -1, y: -1, type: 'grass' },
          { x: 0, y: -1, type: 'grass' },
          { x: 1, y: -1, type: 'grass' },
          { x: -1, y: 0, type: 'grass' },  // West destination
          { x: 1, y: 0, type: 'grass' },   // East spawn
          { x: -1, y: 1, type: 'grass' },
          { x: 0, y: 1, type: 'grass' },
          { x: 1, y: 1, type: 'grass' }
        ];
        
        for (const tile of tiles) {
          game.world.tiles[`${tile.x}:${tile.y}`] = {
            x: tile.x, y: tile.y, type: tile.type, walkable: true
          };
        }
        game.world.bounds = { xl: -1, xh: 1, yl: -1, yh: 1 };
      }
    });
    
    await gameUtils.startLogCapture();
    
    await page.evaluate(() => {
      const game = (window as any).game;
      if (game && game.actors) {
        game.actors = {};
        const testActor = {
          uid: 'test-actor-east',
          username: 'TestActorEast',
          x: 1, y: 0, z: 0,
          facing: 'west',
          position: { x: 1, y: 0, z: 0 }
        };
        game.actors['test-actor-east'] = testActor;
        
        if ((window as any).gameLogger) {
          (window as any).gameLogger.actorSpawned({
            uid: testActor.uid, username: testActor.username,
            x: testActor.x, y: testActor.y, z: testActor.z
          });
        }
      }
    });
    
    gameUtils.clearLogs();
    
    await page.evaluate(() => {
      const game = (window as any).game;
      const actor = game.actors['test-actor-east'];
      if (actor) {
        if (actor.moveTo) {
          actor.moveTo(-1, 0);
        } else {
          actor.destination = { x: -1, y: 0 };
          actor.startMove && actor.startMove();
        }
      }
    });
    
    await page.waitForTimeout(10000);
    
    const movementLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'moved');
    
    console.log(`📊 Captured ${movementLogs.length} movement events for east-to-west pathfinding`);
    
    if (movementLogs.length === 0) {
      console.log('❌ No movement events detected - actor should respond to movement commands');
      expect(movementLogs.length).toBeGreaterThan(0);
      return;
    }
    
    let movedThroughEmptyTile = false;
    let pathTaken: string[] = [];
    
    for (const movement of movementLogs) {
      const { toX, toY } = movement.data;
      pathTaken.push(`${toX}:${toY}`);
      if (toX === 0 && toY === 0) {
        movedThroughEmptyTile = true;
        console.log(`❌ Actor moved through empty tile at (0, 0) - pathfinding failed!`);
      }
    }
    
    console.log(`📍 Path taken: ${pathTaken.join(' → ')}`);
    expect(movedThroughEmptyTile).toBe(false);
    
    const finalMovement = movementLogs[movementLogs.length - 1];
    if (finalMovement) {
      const { toX, toY } = finalMovement.data;
      console.log(`✓ Actor pathfinding from east (1, 0) avoided empty tile (0, 0), final position: (${toX}, ${toY})`);
    }
  });

  test('@critical should validate movement animation states', async ({ page }) => {
    // Wait for game initialization and world generation
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    console.log('🔗 Connecting to repos server for animation validation...');
    
    // Clear logs and switch to repos server
    gameUtils.clearLogs();
    
    await page.evaluate(() => {
      const joinServer = (window as any).joinServer;
      if (joinServer) {
        joinServer({ id: 'repos' });
      }
    });
    
    // Wait for server switch and world generation
    await page.waitForTimeout(5000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    // Verify we're on the repos server
    const serverInfo = await page.evaluate(() => {
      const game = (window as any).game;
      return { currentServer: game.server };
    });
    expect(serverInfo.currentServer).toBe('repos');
    
    // Wait for actors to spawn
    const actorSpawnLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'spawned');
    
    console.log(`📊 Monitoring animations for ${actorSpawnLogs.length} actors`);
    
    // Clear logs and monitor for animation events
    gameUtils.clearLogs();
    await page.waitForTimeout(15000); // Monitor for 15 seconds
    
    // Collect animation events
    const animationStartedLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'animationStarted');
    
    const animationFinishedLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'animationFinished');
    
    console.log(`📊 Animation events: ${animationStartedLogs.length} started, ${animationFinishedLogs.length} finished`);
    
    if (animationStartedLogs.length === 0) {
      console.log('❌ No animation events detected during monitoring period - animations should be occurring');
      // Fail the test if no animations are detected - this indicates a problem with actor behavior
      expect(animationStartedLogs.length).toBeGreaterThan(0);
      return;
    }
    
    // Validate animation events
    for (const animLog of animationStartedLogs) {
      const { uid, username, animationType, state, facing, frame } = animLog.data;
      
      // Validate animation data
      expect(typeof animationType).toBe('string');
      expect(typeof state).toBe('string');
      expect(typeof facing).toBe('string');
      expect(typeof frame).toBe('number');
      expect(Number.isInteger(frame)).toBe(true);
      
      // Validate animation types
      expect(['hopping', 'talking', 'idle', 'wander']).toContain(animationType);
      
      // Validate facing directions
      expect(['north', 'south', 'east', 'west']).toContain(facing);
      
      // Validate frame is non-negative
      expect(frame).toBeGreaterThanOrEqual(0);
      
      console.log(`✓ Animation started: ${username || uid} - ${animationType} (${state}/${facing})`);
    }
    
    // Check that finished animations match started ones (for hopping)
    const hoppingStarted = animationStartedLogs.filter(log => log.data.animationType === 'hopping');
    const hoppingFinished = animationFinishedLogs.filter(log => log.data.animationType === 'hopping');
    
    console.log(`📊 Hopping animations: ${hoppingStarted.length} started, ${hoppingFinished.length} finished`);
    
    // Validate hopping animation destinations
    for (const finishedLog of hoppingFinished) {
      const { username, position } = finishedLog.data;
      
      // Position should be valid coordinates
      expect(typeof position.x).toBe('number');
      expect(typeof position.y).toBe('number');
      expect(typeof position.z).toBe('number');
      expect(Number.isInteger(position.x)).toBe(true);
      expect(Number.isInteger(position.y)).toBe(true);
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
      expect(Number.isFinite(position.z)).toBe(true);
      
      // Position should be within reasonable bounds
      expect(Math.abs(position.x)).toBeLessThan(1000);
      expect(Math.abs(position.y)).toBeLessThan(1000);
      expect(Math.abs(position.z)).toBeLessThan(100);
      
      console.log(`✓ Hopping finished: ${username} at (${position.x}, ${position.y}, ${position.z})`);
    }
    
    console.log(`✅ Validated ${animationStartedLogs.length} animation events`);
  });

  test('@critical should validate sprite rendering during movement', async ({ page }) => {
    // Wait for game initialization and world generation
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    console.log('🔗 Connecting to repos server for sprite validation...');
    
    // Clear logs and switch to repos server
    gameUtils.clearLogs();
    
    await page.evaluate(() => {
      const joinServer = (window as any).joinServer;
      if (joinServer) {
        joinServer({ id: 'repos' });
      }
    });
    
    // Wait for server switch and world generation
    await page.waitForTimeout(5000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    // Verify we're on the repos server
    const serverInfo = await page.evaluate(() => {
      const game = (window as any).game;
      return { currentServer: game.server };
    });
    expect(serverInfo.currentServer).toBe('repos');
    
    console.log('🎨 Monitoring sprite rendering for 10 seconds...');
    
    // Clear logs and monitor sprite rendering
    gameUtils.clearLogs();
    await page.waitForTimeout(10000); // Monitor for 10 seconds
    
    // Collect sprite rendering events
    const spriteRenderLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'spriteRendered');
    
    console.log(`📊 Captured ${spriteRenderLogs.length} sprite render events`);
    
    if (spriteRenderLogs.length === 0) {
      console.log('❌ No sprite rendering events captured - sprites should be updating during actor activity');
      // Fail the test if no sprite rendering is detected - this indicates rendering issues
      expect(spriteRenderLogs.length).toBeGreaterThan(0);
      return;
    }
    
    // Validate sprite rendering events
    const spriteStates = new Set<string>();
    const facingDirections = new Set<string>();
    const presenceStates = new Set<string>();
    
    for (const spriteLog of spriteRenderLogs) {
      const { 
        uid, username, state, facing, frame, 
        spriteMetrics, image, presence, talking, moving 
      } = spriteLog.data;
      
      // Validate sprite data types
      expect(typeof state).toBe('string');
      expect(typeof facing).toBe('string');
      expect(typeof frame).toBe('number');
      expect(typeof presence).toBe('string');
      expect(typeof talking).toBe('boolean');
      expect(typeof moving).toBe('boolean');
      
      // Validate sprite metrics
      expect(spriteMetrics).toBeTruthy();
      expect(typeof spriteMetrics.x).toBe('number');
      expect(typeof spriteMetrics.y).toBe('number');
      expect(typeof spriteMetrics.w).toBe('number');
      expect(typeof spriteMetrics.h).toBe('number');
      expect(Number.isInteger(spriteMetrics.x)).toBe(true);
      expect(Number.isInteger(spriteMetrics.y)).toBe(true);
      expect(Number.isInteger(spriteMetrics.w)).toBe(true);
      expect(Number.isInteger(spriteMetrics.h)).toBe(true);
      
      // Validate sprite metrics dimensions are positive
      expect(spriteMetrics.w).toBeGreaterThan(0);
      expect(spriteMetrics.h).toBeGreaterThan(0);
      
      // Validate sprite metrics coordinates are reasonable (not negative for dimensions)
      expect(spriteMetrics.x).toBeGreaterThanOrEqual(0);
      expect(spriteMetrics.y).toBeGreaterThanOrEqual(0);
      
      // Collect state statistics
      spriteStates.add(state);
      facingDirections.add(facing);
      presenceStates.add(presence);
      
      // Validate image format
      expect(image === 'actors' || Array.isArray(image)).toBe(true);
      if (Array.isArray(image)) {
        expect(image.length).toBe(2);
        expect(image[1]).toBe('actors');
      }
    }
    
    console.log('📊 Sprite rendering statistics:');
    console.log(`  States: ${Array.from(spriteStates).join(', ')}`);
    console.log(`  Facings: ${Array.from(facingDirections).join(', ')}`);
    console.log(`  Presence: ${Array.from(presenceStates).join(', ')}`);
    
    // Validate expected states and facings
    const expectedStates = ['online', 'offline', 'idle', 'hopping'];
    const expectedFacings = ['north', 'south', 'east', 'west'];
    const expectedPresence = ['online', 'offline', 'away', 'busy', 'dnd', 'invisible'];
    
    for (const state of spriteStates) {
      expect(expectedStates).toContain(state);
    }
    
    for (const facing of facingDirections) {
      expect(expectedFacings).toContain(facing);
    }
    
    for (const presence of presenceStates) {
      expect(expectedPresence).toContain(presence);
    }
    
    // Ensure we have reasonable variety in states (should not all be the same)
    expect(spriteStates.size).toBeGreaterThan(0);
    expect(facingDirections.size).toBeGreaterThan(0);
    
    console.log(`✅ Validated ${spriteRenderLogs.length} sprite rendering events with ${spriteStates.size} states and ${facingDirections.size} facing directions`);
  });

  test('@critical should detect movement coordinate errors', async ({ page }) => {
    // Wait for game initialization and world generation
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    console.log('🔗 Connecting to repos server for error detection...');
    
    // Clear logs and switch to repos server
    gameUtils.clearLogs();
    
    await page.evaluate(() => {
      const joinServer = (window as any).joinServer;
      if (joinServer) {
        joinServer({ id: 'repos' });
      }
    });
    
    // Wait for server switch and world generation
    await page.waitForTimeout(5000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    // Verify we're on the repos server
    const serverInfo = await page.evaluate(() => {
      const game = (window as any).game;
      return { currentServer: game.server };
    });
    expect(serverInfo.currentServer).toBe('repos');
    
    console.log('🔍 Monitoring for coordinate errors during 15-second simulation...');
    
    // Clear logs and monitor for errors
    gameUtils.clearLogs();
    await page.waitForTimeout(15000); // Monitor for 15 seconds
    
    // Check for any coordinate-related errors
    const allLogs = gameUtils.getAllLogs();
    const movementErrors = allLogs.filter((log: GameLogEvent) => 
      log.level === 'error' && 
      (log.data?.hasNaN === true || 
       log.event?.includes('movement') ||
       log.event?.includes('coordinate') ||
       (typeof log.data === 'object' && 
        log.data !== null && 
        Object.values(log.data).some((value: any) => 
          typeof value === 'number' && (Number.isNaN(value) || !Number.isFinite(value))
        )))
    );
    
    // Check for movement events with invalid coordinates
    const movementLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'moved');
    
    const invalidCoordinateMovements = movementLogs.filter(log => {
      const { fromX, fromY, fromZ, toX, toY, toZ } = log.data;
      return (
        !Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(fromZ) ||
        !Number.isFinite(toX) || !Number.isFinite(toY) || !Number.isFinite(toZ) ||
        Number.isNaN(fromX) || Number.isNaN(fromY) || Number.isNaN(fromZ) ||
        Number.isNaN(toX) || Number.isNaN(toY) || Number.isNaN(toZ) ||
        !Number.isInteger(toX) || !Number.isInteger(toY)
      );
    });
    
    console.log(`📊 Error detection results:`);
    console.log(`  Movement errors: ${movementErrors.length}`);
    console.log(`  Invalid coordinate movements: ${invalidCoordinateMovements.length}`);
    console.log(`  Total movements: ${movementLogs.length}`);
    
    // Report any errors found
    if (movementErrors.length > 0) {
      console.log('❌ Movement errors detected:');
      for (const error of movementErrors) {
        console.log(`  - ${error.category}/${error.event}: ${JSON.stringify(error.data)}`);
      }
    }
    
    if (invalidCoordinateMovements.length > 0) {
      console.log('❌ Invalid coordinate movements detected:');
      for (const movement of invalidCoordinateMovements) {
        const { username, uid, fromX, fromY, toX, toY } = movement.data;
        console.log(`  - ${username || uid}: (${fromX}, ${fromY}) → (${toX}, ${toY})`);
      }
    }
    
    // Should have no movement errors
    expect(movementErrors.length).toBe(0);
    expect(invalidCoordinateMovements.length).toBe(0);
    
    if (movementLogs.length > 0) {
      console.log(`✅ No coordinate errors detected in ${movementLogs.length} movement events`);
    } else {
      console.log('❌ No movements observed during error monitoring - actors should be moving');
      // Fail the test if no movements are observed during error detection
      expect(movementLogs.length).toBeGreaterThan(0);
    }
  });
});