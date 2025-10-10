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
import { CanvasGameTestUtils, GameAssertions, GameLogEvent } from './utils/canvasTestUtils.js';

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
    
    const { spawnablePositions, mapBounds, worldRadius, totalTiles } = worldGenEvent.data;
    
    // Verify world has valid spawn positions
    expect(spawnablePositions).toBeGreaterThan(0);
    expect(totalTiles).toBeGreaterThan(0);
    expect(mapBounds).toBeTruthy();
    expect(worldRadius).toBeGreaterThan(0);
    
    // Verify map bounds are reasonable
    expect(mapBounds.xl).toBeLessThanOrEqual(mapBounds.xh);
    expect(mapBounds.yl).toBeLessThanOrEqual(mapBounds.yh);
    expect(Math.abs(mapBounds.xl)).toBeLessThanOrEqual(worldRadius);
    expect(Math.abs(mapBounds.xh)).toBeLessThanOrEqual(worldRadius);
    expect(Math.abs(mapBounds.yl)).toBeLessThanOrEqual(worldRadius);
    expect(Math.abs(mapBounds.yh)).toBeLessThanOrEqual(worldRadius);
    
    // Verify sample spawn positions are valid coordinates
    if (worldGenEvent.data.spawnPositions) {
      const samplePositions = worldGenEvent.data.spawnPositions;
      expect(Array.isArray(samplePositions)).toBe(true);
      
      for (const pos of samplePositions) {
        expect(typeof pos).toBe('string');
        const [x, y] = pos.split(':').map(Number);
        expect(Number.isInteger(x)).toBe(true);
        expect(Number.isInteger(y)).toBe(true);
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        
        // Should not be the beacon position
        expect(!(x === 0 && y === 0)).toBe(true);
      }
    }
    
    console.log(`✓ World generated with ${spawnablePositions} valid spawn positions within bounds`);
  });

  test('@critical should validate coordinates when actors do spawn', async ({ page }) => {
    // Wait for game and world initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Get world bounds for validation
    const worldGenLogs = gameUtils.getLogsByCategory('world')
      .filter(log => log.event === 'generated');
    const worldInfo = worldGenLogs[0];
    const { mapBounds } = worldInfo.data;
    
    // Check logs from initialization (don't clear - need server-join message!)
    console.log('🔍 Checking logs from initialization...');
    
    // Get all captured logs for analysis
    const allLogs = gameUtils.getAllLogs();
    const logsByCategory = allLogs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Check for actor spawn events
    const actorLogs = gameUtils.getLogsByCategory('actor');
    console.log(`📊 Actor logs found: ${actorLogs.length}`);
    
    // Get any actor spawn events that occurred
    const spawnLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'spawned');
    
    if (spawnLogs.length === 0) {
      console.log('ℹ No actors spawned automatically - test validates coordinate format requirements');
      
      // Test the coordinate validation logic by checking that the world bounds are reasonable
      expect(mapBounds.xl).toBeLessThanOrEqual(mapBounds.xh);
      expect(mapBounds.yl).toBeLessThanOrEqual(mapBounds.yh);
      expect(Number.isInteger(mapBounds.xl)).toBe(true);
      expect(Number.isInteger(mapBounds.xh)).toBe(true);
      expect(Number.isInteger(mapBounds.yl)).toBe(true);
      expect(Number.isInteger(mapBounds.yh)).toBe(true);
      
      console.log('✓ World bounds are valid integers for coordinate system');
      return;
    }
    
    // If actors did spawn, validate their coordinates
    console.log(`Found ${spawnLogs.length} actor spawn(s) to validate`);
    
    for (const spawnLog of spawnLogs) {
      const { uid, username, x, y, z } = spawnLog.data;
      
      // Basic coordinate validation
      expect(typeof x).toBe('number');
      expect(typeof y).toBe('number');
      expect(typeof z).toBe('number');
      
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isFinite(z)).toBe(true);
      
      // Coordinates should not be NaN
      expect(Number.isNaN(x)).toBe(false);
      expect(Number.isNaN(y)).toBe(false);
      expect(Number.isNaN(z)).toBe(false);
      
      // X and Y should be integers (grid-based world)
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
      
      // Coordinates should be within reasonable world bounds
      expect(x).toBeGreaterThanOrEqual(mapBounds.xl - 1);
      expect(x).toBeLessThanOrEqual(mapBounds.xh + 1);
      expect(y).toBeGreaterThanOrEqual(mapBounds.yl - 1);
      expect(y).toBeLessThanOrEqual(mapBounds.yh + 1);
      
      // Z coordinate should be reasonable
      expect(z).toBeGreaterThanOrEqual(-10);
      expect(z).toBeLessThanOrEqual(10);
      
      // Should not spawn at beacon position
      expect(!(x === 0 && y === 0)).toBe(true);
      
      console.log(`✓ Actor ${username} (${uid}) has valid coordinates: (${x}, ${y}, ${z})`);
    }
  });

  test('@critical should detect coordinate errors if they occur', async ({ page }) => {
    // Wait for game and world initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Monitor logs for coordinate-related errors
    gameUtils.clearLogs();
    await page.waitForTimeout(15000); // Wait longer for potential issues
    
    // Check for any coordinate-related error logs
    const allRecentLogs = gameUtils.getAllLogs();
    const coordinateErrors = allRecentLogs
      .filter((log: GameLogEvent) => 
        log.level === 'error' && 
        (log.data?.hasNaN === true || 
         (typeof log.data === 'object' && 
          log.data !== null && 
          Object.values(log.data).some((value: any) => 
            typeof value === 'number' && (Number.isNaN(value) || !Number.isFinite(value))
          )))
      );
    
    // Should have no coordinate-related errors
    expect(coordinateErrors.length).toBe(0);
    
    // Also check for any actor spawn events and validate them
    const spawnLogs = gameUtils.getLogsByCategory('actor')
      .filter(log => log.event === 'spawned');
    
    // If any actors spawned, verify they have clean coordinate data
    for (const spawnLog of spawnLogs) {
      const { x, y, z } = spawnLog.data;
      
      // Should not be edge case values
      expect(x).not.toBe(Infinity);
      expect(x).not.toBe(-Infinity);
      expect(y).not.toBe(Infinity);
      expect(y).not.toBe(-Infinity);
      expect(z).not.toBe(Infinity);
      expect(z).not.toBe(-Infinity);
      
      // Should not be extremely large values that might indicate calculation errors
      expect(Math.abs(x)).toBeLessThan(1000);
      expect(Math.abs(y)).toBeLessThan(1000);
      expect(Math.abs(z)).toBeLessThan(100);
    }
    
    if (spawnLogs.length > 0) {
      console.log(`✓ Validated ${spawnLogs.length} actors with clean coordinate data, no errors detected`);
    } else {
      console.log('✓ No coordinate errors detected during monitoring period');
    }
  });
});