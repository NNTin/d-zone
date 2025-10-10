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
    const tagName = await canvas.evaluate((el: HTMLElement) => el.tagName);
    expect(tagName).toBe('CANVAS');    // Verify canvas has dimensions
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
    // Get initial canvas dimensions from game initialization
    const initialEvent = await gameUtils.waitForGameEvent('game', 'initialized');
    const initialWidth = initialEvent.data.width;
    const initialHeight = initialEvent.data.height;
    
    // Clear existing logs to focus on resize events
    gameUtils.clearLogs();
    
    // Resize viewport to trigger canvas resize
    // The canvas system calculates new dimensions as: Math.ceil(window.inner* / scale)
    // With scale=2, a 1200x800 viewport should result in 600x400 canvas dimensions
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Wait a moment for the resize to be processed
    await page.waitForTimeout(100);
    
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
    // Note: Canvas dimensions are calculated as Math.ceil(viewport / scale)
    expect(resizeEvent.data.width !== initialWidth || resizeEvent.data.height !== initialHeight).toBe(true);
    
    // Verify the active canvas element reflects new size
    // The active canvas is the one with z-index: 5 (currently main2 with scale=2)
    const activeCanvas = page.locator('canvas[style*="z-index: 5"]');
    await expect(activeCanvas).toBeVisible();
    
    // Verify the active canvas has been resized
    const canvasWidth = await activeCanvas.getAttribute('width');
    const canvasHeight = await activeCanvas.getAttribute('height');
    expect(parseInt(canvasWidth!)).toBe(resizeEvent.data.width);
    expect(parseInt(canvasHeight!)).toBe(resizeEvent.data.height);
    
    // Take debug screenshot after resize
    await gameUtils.takeDebugScreenshot('after-resize');
  });

  test('@critical should handle multiple rapid resizes', async ({ page }) => {
    // Wait for initial load
    await gameUtils.waitForGameEvent('game', 'initialized');
    
    // Clear existing logs to focus on resize events
    gameUtils.clearLogs();
    
    // Perform multiple rapid resizes with significantly different viewport sizes
    // Each should trigger a canvas resize since dimensions = Math.ceil(viewport / scale)
    const resizeSizes = [
      { width: 800, height: 600 },   // Should result in ~400x300 canvas (scale=2)
      { width: 1440, height: 900 },  // Should result in ~720x450 canvas (scale=2)
      { width: 1920, height: 1080 }  // Should result in ~960x540 canvas (scale=2)
    ];
    
    for (const size of resizeSizes) {
      await page.setViewportSize(size);
      // Small delay to allow resize processing
      await page.waitForTimeout(150);
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
    
    // Verify the active canvas (z-index: 5) is still functional after rapid resizes
    const activeCanvas = page.locator('canvas[style*="z-index: 5"]');
    await expect(activeCanvas).toBeVisible();
    
    // Verify the active canvas has the expected dimensions from the last resize
    const canvasWidth = await activeCanvas.getAttribute('width');
    const canvasHeight = await activeCanvas.getAttribute('height');
    expect(parseInt(canvasWidth!)).toBe(lastResize.data.width);
    expect(parseInt(canvasHeight!)).toBe(lastResize.data.height);
  });

  test('@critical should maintain game state after resize', async ({ page }) => {
    // Wait for initial game load
    await gameUtils.waitForGameEvent('game', 'initialized');
    
    // Wait for any initial actors to spawn
    await page.waitForTimeout(2000);
    const initialActorCount = gameUtils.getGameState().actorCount;
    
    // Clear logs to focus on resize events
    gameUtils.clearLogs();
    
    // Resize viewport to a significantly different size
    await page.setViewportSize({ width: 1600, height: 900 });
    
    // Wait for resize event
    await gameUtils.waitForGameEvent('canvas', 'resize', 5000);
    
    // Wait a moment for any post-resize processing
    await page.waitForTimeout(1000);
    
    // Verify game state is preserved
    const finalActorCount = gameUtils.getGameState().actorCount;
    expect(finalActorCount).toBe(initialActorCount);
    
    // Verify the active canvas is still interactive
    const activeCanvas = page.locator('canvas[style*="z-index: 5"]');
    await expect(activeCanvas).toBeVisible();
    
    // Try a canvas interaction to verify it's still working
    // Click on the active canvas (which should be scaled appropriately)
    await activeCanvas.hover();
    
    // Game should still be responsive
    await page.waitForTimeout(500);
    
    // Verify all 4 canvases are still present with correct scaling
    const allCanvases = page.locator('canvas[id^="main"]');
    const canvasCount = await allCanvases.count();
    expect(canvasCount).toBe(4);
    
    // Verify the active canvas has the correct z-index
    const activeCanvasZIndex = await activeCanvas.evaluate(
      (el: HTMLElement) => window.getComputedStyle(el).zIndex
    );
    expect(activeCanvasZIndex).toBe('5');
  });

  test('@critical should handle error cases gracefully', async ({ page }) => {
    // Wait for initial game load
    await gameUtils.waitForGameEvent('game', 'initialized');
    
    // Test 1: Try to resize to invalid dimensions (too small)
    gameUtils.clearLogs();
    await page.setViewportSize({ width: 1, height: 1 });
    
    // Game should handle this gracefully - wait for potential resize event
    await page.waitForTimeout(2000);
    
    // Verify canvases still exist and one is active
    const allCanvases = page.locator('canvas[id^="main"]');
    const canvasCount = await allCanvases.count();
    expect(canvasCount).toBe(4);
    
    const activeCanvas = page.locator('canvas[style*="z-index: 5"]');
    await expect(activeCanvas).toBeVisible();
    
    // Test 2: Rapid viewport changes
    gameUtils.clearLogs();
    for (let i = 0; i < 3; i++) {
      const width = 800 + i * 200;
      const height = 600 + i * 150;
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100); // Short delay between changes
    }
    
    // Wait for any pending resize operations to complete
    await page.waitForTimeout(1000);
    
    // Verify game is still in a valid state
    const finalActiveCanvas = page.locator('canvas[style*="z-index: 5"]');
    await expect(finalActiveCanvas).toBeVisible();
    
    // Verify all 4 canvases are still present
    const finalCanvasCount = await allCanvases.count();
    expect(finalCanvasCount).toBe(4);
    
    // Test 3: Try to access canvas context after resize stress test
    const canvasContext = await activeCanvas.evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      return ctx !== null;
    });
    expect(canvasContext).toBe(true);
    
    // Verify the active canvas has proper dimensions
    const activeCanvasDimensions = await activeCanvas.evaluate((canvas: HTMLCanvasElement) => {
      return {
        width: canvas.width,
        height: canvas.height
      };
    });
    
    expect(activeCanvasDimensions.width).toBeGreaterThan(0);
    expect(activeCanvasDimensions.height).toBeGreaterThan(0);
  });
});