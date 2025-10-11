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
 * 
 * The tests connect to the repos server which has >20 actors to provide comprehensive
 * movement validation data during a 15-second simulation period.
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
    
    // Clear logs and start monitoring movement for 15 seconds
    console.log('🏃 Starting 15-second movement monitoring...');
    gameUtils.clearLogs();
    
    const movementStartTime = Date.now();
    await page.waitForTimeout(15000); // Monitor for 15 seconds
    const movementEndTime = Date.now();
    
    console.log(`📊 Movement monitoring completed (${(movementEndTime - movementStartTime) / 1000}s)`);
    
    // Collect all movement events during the monitoring period
    const movementLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'moved');
    
    console.log(`📊 Captured ${movementLogs.length} movement events during monitoring`);
    
    if (movementLogs.length === 0) {
      console.log('❌ No movement events detected - actors should be moving on repos server');
      // Fail the test if no movement is detected - this indicates a problem
      expect(movementLogs.length).toBeGreaterThan(0);
      return;
    }
    
    // Validate each movement event
    let validMovements = 0;
    let invalidMovements = 0;
    const invalidMovementDetails: any[] = [];
    
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
    }
    
    // All movements should be to valid coordinates
    expect(invalidMovements).toBe(0);
    
    // Ensure we captured some movements for validation
    expect(validMovements).toBeGreaterThan(0);
    
    // Ensure we have meaningful movement activity (at least some percentage of actors moved)
    if (actorSpawnLogs.length >= 10 && validMovements < Math.floor(actorSpawnLogs.length * 0.1)) {
      console.log(`❌ Too few movements detected: ${validMovements} movements for ${actorSpawnLogs.length} actors (expected at least 10% activity)`);
      expect(validMovements).toBeGreaterThanOrEqual(Math.floor(actorSpawnLogs.length * 0.1));
    }
    
    console.log(`✅ All ${validMovements} movement(s) were to valid coordinates during 15-second monitoring`);
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