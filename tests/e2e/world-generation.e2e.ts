/**
 * @file E2E tests for world generation
 * @description Tests that validate world generation
 * 
 * This test suite verifies that:
 * 1. todo: Add description
 */

import { expect, test } from '@playwright/test';
import { CanvasGameTestUtils, GameAssertions } from './utils/canvasTestUtils.js';
import {
  extractSpawnAnalysisData,
  getActorSpawnLogs,
  getSpawnAnalysisLogs,
  getWorldGenerationData,
  type ActorCoordinates
} from './utils/spawnValidationUtils.js';

test.describe('World Generation', () => {
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
    const { mapBounds } = worldData!;
    
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
});
