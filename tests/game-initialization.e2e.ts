/**
 * @file E2E tests for game initialization and canvas functionality
 * @description Tests game startup, initialization, and canvas resize using log-based testing
 */

import { expect, test } from '@playwright/test';
import { CanvasGameTestUtils, GameAssertions } from './utils/canvasTestUtils.js';

test.describe('@critical Game Initialization', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
    
    // Navigate to the game
    await page.goto('/?e2e-test=true');
    
    // Verify canvas is visible before testing
    await GameAssertions.assertCanvasVisible(page);
  });

  test('@critical should initialize game with valid canvas dimensions', async ({ page }) => {
    // Wait for game initialization event
    const initEvent = await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    
    // Verify initialization event contains valid data
    expect(initEvent).toBeTruthy();
    expect(initEvent.category).toBe('game');
    expect(initEvent.event).toBe('initialized');
    
    // Verify canvas dimensions are valid numbers
    expect(initEvent.data).toBeTruthy();
    expect(typeof initEvent.data.width).toBe('number');
    expect(typeof initEvent.data.height).toBe('number');
    expect(initEvent.data.width).toBeGreaterThan(0);
    expect(initEvent.data.height).toBeGreaterThan(0);
    
    // Verify minimum reasonable canvas size
    expect(initEvent.data.width).toBeGreaterThanOrEqual(400);
    expect(initEvent.data.height).toBeGreaterThanOrEqual(300);
    
    // Verify game state is properly updated
    await GameAssertions.assertGameLoaded(gameUtils);
    const gameState = gameUtils.getGameState();
    expect(gameState.initialized).toBe(true);
    expect(gameState.canvasSize).toBeTruthy();
    expect(gameState.canvasSize?.width).toBe(initEvent.data.width);
    expect(gameState.canvasSize?.height).toBe(initEvent.data.height);
  });

  test('@critical should log initial draw completion', async ({ page }) => {
    // Wait for game initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    
    // Wait for initial draw event
    const drawEvent = await gameUtils.waitForGameEvent('game', 'initial_draw', 10000);
    
    // Verify initial draw event
    expect(drawEvent).toBeTruthy();
    expect(drawEvent.category).toBe('game');
    expect(drawEvent.event).toBe('initial_draw');
    
    // Take a debug screenshot to verify visual state
    await gameUtils.takeDebugScreenshot('initial-draw-complete');
  });

  test('@critical should have canvas element with correct properties', async ({ page }) => {
    // Wait for game initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    
    // Verify canvas element properties
    await GameAssertions.assertCanvasVisible(page);
    const canvas = page.locator('canvas[id^="main"]').first();

    // Check canvas tag and basic properties
    expect(await canvas.getAttribute('tagName')).toBe('CANVAS');    // Verify canvas has dimensions
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
    
    // Verify canvas context is available
    const hasContext = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d');
      return ctx !== null;
    });
    expect(hasContext).toBe(true);
  });
});

test.describe('@critical Canvas Resize Functionality', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
    
    // Navigate to the game
    await page.goto('/?e2e-test=true');
    
    // Wait for initial game load
    await GameAssertions.assertCanvasVisible(page);
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
  });

  test('@critical should handle viewport resize correctly', async ({ page }) => {
    // Get initial canvas dimensions
    const initialEvent = await gameUtils.waitForGameEvent('game', 'initialized');
    const initialWidth = initialEvent.data.width;
    const initialHeight = initialEvent.data.height;
    
    // Resize viewport to trigger canvas resize
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Wait for canvas resize event
    const resizeEvent = await gameUtils.waitForGameEvent('canvas', 'resize', 10000);
    
    // Verify resize event contains valid data
    expect(resizeEvent).toBeTruthy();
    expect(resizeEvent.category).toBe('canvas');
    expect(resizeEvent.event).toBe('resize');
    expect(typeof resizeEvent.data.width).toBe('number');
    expect(typeof resizeEvent.data.height).toBe('number');
    expect(resizeEvent.data.width).toBeGreaterThan(0);
    expect(resizeEvent.data.height).toBeGreaterThan(0);
    
    // Verify dimensions actually changed
    expect(resizeEvent.data.width !== initialWidth || resizeEvent.data.height !== initialHeight).toBe(true);
    
    // Verify canvas element reflects new size
    const canvas = page.locator('canvas[id^="main"]').first();
    const newBox = await canvas.boundingBox();
    expect(newBox).toBeTruthy();
    expect(newBox!.width).toBeGreaterThan(0);
    expect(newBox!.height).toBeGreaterThan(0);
    
    // Take debug screenshot after resize
    await gameUtils.takeDebugScreenshot('after-resize');
  });

  test('@critical should handle multiple rapid resizes', async ({ page }) => {
    // Wait for initial load
    await gameUtils.waitForGameEvent('game', 'initialized');
    
    // Clear existing logs to focus on resize events
    gameUtils.clearLogs();
    
    // Perform multiple rapid resizes
    const resizeSizes = [
      { width: 800, height: 600 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 }
    ];
    
    for (const size of resizeSizes) {
      await page.setViewportSize(size);
      // Small delay to allow resize processing
      await page.waitForTimeout(100);
    }
    
    // Wait for at least one resize event
    await gameUtils.waitForGameEvent('canvas', 'resize', 5000);
    
    // Verify we got resize events
    const resizeEvents = gameUtils.getLogsByCategory('canvas')
      .filter(log => log.event === 'resize');
    
    expect(resizeEvents.length).toBeGreaterThan(0);
    
    // Verify final resize event has valid dimensions
    const lastResize = resizeEvents[resizeEvents.length - 1];
    expect(lastResize.data.width).toBeGreaterThan(0);
    expect(lastResize.data.height).toBeGreaterThan(0);
    
    // Verify canvas is still functional after rapid resizes
    await GameAssertions.assertCanvasVisible(page);
    const canvas = page.locator('canvas[id^="main"]').first();
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  });

  test('@critical should maintain game state after resize', async ({ page }) => {
    // Wait for initial game load
    await gameUtils.waitForGameEvent('game', 'initialized');
    
    // Wait for any initial actors to spawn
    await page.waitForTimeout(2000);
    const initialActorCount = gameUtils.getGameState().actorCount;
    
    // Resize viewport
    await page.setViewportSize({ width: 1000, height: 700 });
    
    // Wait for resize event
    await gameUtils.waitForGameEvent('canvas', 'resize', 5000);
    
    // Wait a moment for any post-resize processing
    await page.waitForTimeout(1000);
    
    // Verify game state is preserved
    const finalActorCount = gameUtils.getGameState().actorCount;
    expect(finalActorCount).toBe(initialActorCount);
    
    // Verify game is still interactive (canvas should still accept events)
    await GameAssertions.assertCanvasVisible(page);
    const canvas = page.locator('canvas[id^="main"]').first();
    
    // Try a canvas interaction to verify it's still working
    await gameUtils.hoverOnCanvas(100, 100);
    
    // Game should still be responsive
    await page.waitForTimeout(500);
  });
});