/**
 * E2E Tests for D-Back WebSocket Server Integration
 * 
 * Purpose: Tests that verify the web client can connect to a real d-back server,
 * receive server-list, and spawn actors with real backend data.
 * 
 * Requirements:
 * - d-back server must be running on ws://127.0.0.1:3000
 * - Server is automatically started by Playwright webServer configuration
 * - Requires PW_INCLUDE_DBACK=1 and either DBACK_VERSION or DBACK_COMMIT
 * 
 * Usage Examples:
 * - PyPI version:  DBACK_VERSION=0.0.14 PW_INCLUDE_DBACK=1 npm run test:e2e:dback-pypi
 * - Git commit:    DBACK_COMMIT=abc123 PW_INCLUDE_DBACK=1 npm run test:e2e:dback-commit
 * 
 * Note: These tests use the @dback tag and are excluded from CI runs.
 */

import { expect, test } from '@playwright/test';
import { CanvasGameTestUtils, GameAssertions } from './utils/canvasTestUtils.js';

test.describe('@dback D-Back Server Integration', () => {
  let gameUtils: CanvasGameTestUtils;
  
  // Extend timeout for backend integration tests
  test.setTimeout(60000);
  
  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    gameUtils.startLogCapture();
  });
  
  test.afterEach(async () => {
    // Log any browser errors for debugging
    gameUtils.printBrowserErrors();
  });

  test('@dback should connect to real d-back WebSocket server', async ({ page }) => {
    // Navigate with custom socketURL to connect to d-back server
    await page.goto('/?socketURL=ws://127.0.0.1:3000&e2e-test=true');
    
    // Wait for canvas to be visible
    await GameAssertions.assertCanvasVisible(page);
    
    // Wait for WebSocket connection
    const connectionEvent = await gameUtils.waitForGameEvent('websocket', 'connected', 15000);
    
    // Verify the connection URL
    expect(connectionEvent.data).toBeDefined();
    expect(connectionEvent.data.url).toBe('ws://127.0.0.1:3000');
    
    console.log('✓ Successfully connected to d-back server at ws://127.0.0.1:3000');
  });

  test('@dback should receive server-list from d-back server', async ({ page }) => {
    await page.goto('/?socketURL=ws://127.0.0.1:3000&e2e-test=true');
    await GameAssertions.assertCanvasVisible(page);
    
    // Wait for WebSocket connection
    await gameUtils.waitForGameEvent('websocket', 'connected', 15000);
    
    // Wait for server-list message
    await gameUtils.waitForGameEvent('websocket', 'message_received', 15000);
    
    // Find server-list message in logs by messageType
    const websocketLogs = gameUtils.getLogsByCategory('websocket');
    const serverListLogs = websocketLogs.filter(
      log => log.event === 'message_received' && log.data.messageType === 'server-list'
    );
    
    expect(serverListLogs.length).toBeGreaterThan(0);
    
    // Retrieve the live server list from game state
    const servers = await page.evaluate(() => (window as any).game.servers);
    
    expect(servers).toBeDefined();
    expect(typeof servers).toBe('object');
    
    // Verify server list structure
    const serverArray = Object.values(servers);
    
    if (serverArray.length === 0) {
      console.log('ℹ️  Server list is empty - d-back server has no configured servers');
    } else {
      // Verify each server has required properties
      serverArray.forEach((server: any) => {
        expect(server.id).toBeDefined();
        expect(server.name).toBeDefined();
        expect(typeof server.passworded).toBe('boolean');
      });
      
      console.log(`📊 Received ${serverArray.length} servers from d-back`);
      serverArray.forEach((server: any) => {
        console.log(`   - ${server.name} (${server.id})`);
      });
    }
  });

  test('@dback should join a server and receive user list', async ({ page }) => {
    await page.goto('/?socketURL=ws://127.0.0.1:3000&e2e-test=true');
    await GameAssertions.assertCanvasVisible(page);
    
    // Wait for game initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    
    // Wait for server_joined event
    const serverJoinedEvent = await gameUtils.waitForGameEvent('websocket', 'server_joined', 15000);
    
    // Read the joined server ID from game state
    const joinedServerId = await page.evaluate(() => (window as any).game.server);
    
    // Verify the event's serverId matches the game state
    expect(serverJoinedEvent.data.serverId).toBeDefined();
    expect(joinedServerId).toBe(serverJoinedEvent.data.serverId);
    
    // Optionally get server name from servers list
    const servers = await page.evaluate(() => (window as any).game.servers);
    const serverName = servers[joinedServerId]?.name || 'Unknown';
    
    console.log(`✓ Joined server: ${serverName} (${joinedServerId})`);
    
    // Get users from game state
    const users = await page.evaluate(() => (window as any).game.users);
    expect(users).toBeDefined();
    expect(typeof users).toBe('object');
    
    const userArray = Object.values(users);
    console.log(`📊 Received ${userArray.length} users from d-back server`);
    
    // Verify users structure
    userArray.forEach((user: any) => {
      expect(user.uid).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.presence).toBeDefined();
    });
  });

  test('@dback should spawn actors from real d-back user data', async ({ page }) => {
    await page.goto('/?socketURL=ws://127.0.0.1:3000&e2e-test=true');
    await GameAssertions.assertCanvasVisible(page);
    
    // Wait for game and world initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 15000);
    
    // Wait for server-join to get user list
    await gameUtils.waitForGameEvent('websocket', 'message_received', 15000);
    
    // Wait additional time for actors to spawn
    await page.waitForTimeout(5000);
    
    // Get actor spawn logs
    const actorLogs = gameUtils.getLogsByCategory('actor');
    const spawnedActors = actorLogs.filter(log => log.event === 'spawned');
    
    if (spawnedActors.length > 0) {
      // Verify actor spawning
      spawnedActors.forEach((actorLog: any) => {
        expect(actorLog.data.uid).toBeDefined();
        expect(typeof actorLog.data.uid).toBe('string');
        expect(actorLog.data.username).toBeDefined();
        expect(typeof actorLog.data.username).toBe('string');
        expect(typeof actorLog.data.x).toBe('number');
        expect(typeof actorLog.data.y).toBe('number');
        expect(typeof actorLog.data.z).toBe('number');
        
        // Verify coordinates are valid
        expect(Number.isInteger(actorLog.data.x)).toBe(true);
        expect(Number.isInteger(actorLog.data.y)).toBe(true);
        expect(Number.isInteger(actorLog.data.z)).toBe(true);
        expect(Number.isNaN(actorLog.data.x)).toBe(false);
        expect(Number.isNaN(actorLog.data.y)).toBe(false);
        expect(Number.isNaN(actorLog.data.z)).toBe(false);
        expect(Number.isFinite(actorLog.data.x)).toBe(true);
        expect(Number.isFinite(actorLog.data.y)).toBe(true);
        expect(Number.isFinite(actorLog.data.z)).toBe(true);
      });
      
      console.log(`✓ Spawned ${spawnedActors.length} actors from d-back data`);
      spawnedActors.forEach((actorLog: any) => {
        console.log(`   - ${actorLog.data.username} at (${actorLog.data.x}, ${actorLog.data.y}, ${actorLog.data.z})`);
      });
    } else {
      console.log('ℹ️  No actors spawned - d-back server may have no active users');
    }
  });

  test('@dback should handle real-time presence updates', async ({ page }) => {
    await page.goto('/?socketURL=ws://127.0.0.1:3000&e2e-test=true');
    await GameAssertions.assertCanvasVisible(page);
    
    // Wait for game initialization and server join
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('websocket', 'server_joined', 15000);
    
    // Clear logs to focus on presence updates
    gameUtils.clearLogs();
    
    // Wait for presence update messages (if any occur during test)
    await page.waitForTimeout(10000);
    
    // Check for presence update logs by messageType
    const websocketLogs = gameUtils.getLogsByCategory('websocket');
    const presenceUpdateLogs = websocketLogs.filter(
      log => log.event === 'message_received' && log.data.messageType === 'presence'
    );
    
    if (presenceUpdateLogs.length > 0) {
      console.log(`✓ Received ${presenceUpdateLogs.length} presence updates from d-back`);
      
      // Optionally check for actor:updated events that presence changes may trigger
      const actorLogs = gameUtils.getLogsByCategory('actor');
      const actorUpdateLogs = actorLogs.filter(log => log.event === 'updated');
      
      if (actorUpdateLogs.length > 0) {
        console.log(`   - Triggered ${actorUpdateLogs.length} actor updates`);
      }
    } else {
      console.log('ℹ️  No presence updates during test period (this is normal if no user activity)');
    }
    
    // Verify the game is still responsive
    await GameAssertions.assertCanvasVisible(page);
  });

  test('@dback should handle connection errors gracefully', async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    gameUtils.startLogCapture();
    
    // Navigate to an invalid WebSocket URL to test error handling
    await page.goto('/?socketURL=ws://127.0.0.1:9999&e2e-test=true');
    
    // Wait for canvas to be visible (game should still initialize)
    await GameAssertions.assertCanvasVisible(page);
    
    // Wait for error or fallback connection attempt
    await page.waitForTimeout(5000);
    
    // Check logs for WebSocket disconnection or error events
    const websocketLogs = gameUtils.getLogsByCategory('websocket');
    const disconnectLogs = websocketLogs.filter(log => log.event === 'disconnected');
    const errorLogs = websocketLogs.filter(log => log.event === 'error');
    
    // Check for fallback connection (may connect to a different URL)
    const connectedLogs = websocketLogs.filter(log => log.event === 'connected');
    
    // Log what happened
    if (disconnectLogs.length > 0 || errorLogs.length > 0) {
      console.log(`✓ Connection error detected: ${disconnectLogs.length} disconnects, ${errorLogs.length} errors`);
    } else {
      console.log('ℹ️  No explicit error events logged');
    }
    
    if (connectedLogs.length > 0) {
      const fallbackUrl = connectedLogs[connectedLogs.length - 1].data?.url;
      console.log(`✓ Fallback connection established to: ${fallbackUrl || 'unknown URL'}`);
    }
    
    // Game should not crash - verify responsiveness
    await GameAssertions.assertCanvasVisible(page);
    
    // Check for browser errors
    const browserErrors = gameUtils.getLogsByCategory('error');
    
    // Assert game remains functional
    expect(await page.isVisible('canvas')).toBe(true);
    
    console.log('✓ Connection error handled gracefully, game remains responsive');
  });
});
