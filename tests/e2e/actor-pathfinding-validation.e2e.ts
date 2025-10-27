/**
 * @file E2E tests for actor pathfinding validation
 * @description Tests that validate actor movement and pathfinding behavior
 * 
 * This test suite verifies that:
 * 1. Actors can successfully navigate between different positions using goto
 * 2. Movement coordinates are accurately tracked and validated
 * 3. Pathfinding works correctly across different world configurations
 */

import { expect, test } from '@playwright/test';
import {
    generateCustomMockActors,
    getMockActorPositioningScript,
    getMockWebSocketScriptWithActors,
    getMockWorldGenerationScript,
    MOCK_WORLDS,
    MockActorPositioning
} from './mocks/index';
import { CanvasGameTestUtils, GameAssertions } from './utils/canvasTestUtils.js';
import {
    getActorSpawnLogs,
    getWorldGenerationData
} from './utils/spawnValidationUtils.js';

test.describe('@normal Actor Pathfinding Validation', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
    
    // Navigate to the game
    await page.goto('/?e2e-test=true');
    
    // Verify canvas is visible before testing
    await GameAssertions.assertCanvasVisible(page);
  });

  test('@normal should move actor from (1,1) to (2,2) using message-triggered pathfinding in GRID_SMALL_ISLANDS world', async ({ page }) => {
    const testDescription = 'Actor pathfinding: message-triggered movement from (1,1) to (2,2) in grid small islands world';
    
    // Create two custom actors
    const testActors = generateCustomMockActors(['PathfinderBot', 'MessageSender']);
    
    // Set up actor positioning mock - place first actor at (1,1) and second at (5,5)
    const positioning: MockActorPositioning = {
      fixedPositions: [
        { uid: 'mock-user-1', x: 1, y: 1, z: 0 },
        { uid: 'mock-user-2', x: 5, y: 5, z: 0 }
      ]
    };
    
    console.log('🎯 Setting up message-triggered pathfinding test...');
    console.log('📍 PathfinderBot initial position: (1, 1, 0)');
    console.log('📍 MessageSender initial position: (5, 5, 0)');
    console.log('📍 Expected behavior: MessageSender sends message → PathfinderBot moves toward MessageSender');
    
    // Set up world generation mock with GRID_SMALL_ISLANDS
    await page.addInitScript(getMockWorldGenerationScript(), {
      ...MOCK_WORLDS.GRID_SMALL_ISLANDS,
      testDescription
    });
    
    // Set up actor positioning mock
    await page.addInitScript(getMockActorPositioningScript(), positioning);
    
    // Set up WebSocket mock with two actors
    await page.addInitScript(getMockWebSocketScriptWithActors(), {
      serverId: 'pathfinding-test',
      serverName: 'Pathfinding Test Server',
      actors: testActors
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
    expect(mockInfo.positioning).toBe(true);
    expect(mockInfo.websocket).toBe(true);
    expect(mockInfo.world).toBeTruthy(); // Check that world mock exists and is enabled
    
    // Wait for game initialization
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    await gameUtils.waitForGameEvent('world', 'generated', 10000);
    
    // Wait for both actors to spawn
    console.log('⏳ Waiting for actors to spawn at initial positions...');
    await page.waitForTimeout(2000);
    
    // Get spawned actors
    const spawnLogs = getActorSpawnLogs(gameUtils);
    console.log(`📊 Found ${spawnLogs.length} actor spawn(s)`);
    
    // Verify both actors spawned
    expect(spawnLogs.length).toBe(2);
    
    // Check initial positions
    const pathfinderBot = spawnLogs.find(log => log.data.username === 'PathfinderBot');
    const messageSender = spawnLogs.find(log => log.data.username === 'MessageSender');
    
    expect(pathfinderBot).toBeDefined();
    expect(messageSender).toBeDefined();
    
    // Verify PathfinderBot position
    expect(pathfinderBot!.data.x).toBe(1);
    expect(pathfinderBot!.data.y).toBe(1);
    expect(pathfinderBot!.data.z).toBe(0);
    
    // Verify MessageSender position  
    expect(messageSender!.data.x).toBe(5);
    expect(messageSender!.data.y).toBe(5);
    expect(messageSender!.data.z).toBe(0);
    
    console.log(`✅ PathfinderBot spawned at (${pathfinderBot!.data.x}, ${pathfinderBot!.data.y}, ${pathfinderBot!.data.z})`);
    console.log(`✅ MessageSender spawned at (${messageSender!.data.x}, ${messageSender!.data.y}, ${messageSender!.data.z})`);
    
    // Simulate WebSocket message from MessageSender to trigger pathfinding
    console.log('📨 Simulating WebSocket message from MessageSender to trigger PathfinderBot pathfinding...');
    
    const messageResult = await page.evaluate(() => {
      // Get the game and actors to create the message structure
      const game = (window as any).game;
      if (!game || !game.users || !game.users.actors) {
        return { success: false, error: 'Game or actors not available' };
      }
      
      const actors = Object.values(game.users.actors);
      if (actors.length < 2) {
        return { success: false, error: `Expected 2 actors, found ${actors.length}` };
      }
      
      const pathfinderBot = actors.find((actor: any) => actor.username === 'PathfinderBot') as any;
      const messageSender = actors.find((actor: any) => actor.username === 'MessageSender') as any;
      
      if (!pathfinderBot || !messageSender) {
        return { 
          success: false, 
          error: 'Could not find expected actors',
          foundActors: actors.map((a: any) => a.username)
        };
      }
      
      console.log('📨 [MESSAGE] Found both actors, preparing WebSocket message...');
      console.log('📨 [MESSAGE] PathfinderBot:', {
        position: pathfinderBot.position,
        presence: pathfinderBot.presence,
        lastMessage: pathfinderBot.lastMessage
      });
      console.log('📨 [MESSAGE] MessageSender:', {
        position: messageSender.position,
        presence: messageSender.presence
      });
      
      // Set up PathfinderBot to have a recent talking activity so it can receive messages
      // This simulates PathfinderBot having recently talked in the same channel
      pathfinderBot.lastMessage = { 
        channel: 'general', 
        time: Date.now() - 1000 // 1 second ago
      };
      
      // Ensure both actors are online for message handling
      if (pathfinderBot.presence !== 'online') {
        pathfinderBot.updatePresence('online');
      }
      if (messageSender.presence !== 'online') {
        messageSender.updatePresence('online');
      }
      
      // Create a WebSocket message that mimics the real server message structure
      // This follows the format from main.ts: data.type === 'message' and users.queueMessage(data.data)
      // The Users.queueMessage expects: {uid, message, channel}
      const websocketMessage = {
        type: 'message',
        data: {
          uid: messageSender.uid, // The UID of the actor sending the message
          message: 'Hello PathfinderBot!', // The message content
          channel: 'general' // The channel
        }
      };
      
      try {
        // Use the mock WebSocket to simulate incoming message
        const simulateMessage = (window as any).__simulateWebSocketMessage;
        if (!simulateMessage) {
          return { success: false, error: 'WebSocket message simulation not available' };
        }
        
        console.log('📨 [MESSAGE] Sending WebSocket message simulation...');
        const simulated = simulateMessage(websocketMessage);
        
        if (!simulated) {
          return { success: false, error: 'Failed to simulate WebSocket message' };
        }
        
        console.log('📨 [MESSAGE] WebSocket message simulated successfully');
        
        // Wait a moment and check if the message was processed
        setTimeout(() => {
          console.log('📨 [MESSAGE] Post-message PathfinderBot state:', {
            behaviors: pathfinderBot.behaviors.map((b: any) => b.constructor.name),
            behaviorCount: pathfinderBot.behaviors.length,
            hasGoTo: pathfinderBot.behaviors.some((b: any) => b.constructor.name === 'GoTo')
          });
        }, 100);
        
        return { 
          success: true,
          message: 'WebSocket message simulated successfully',
          pathfinderBotUid: pathfinderBot.uid,
          messageSenderUid: messageSender.uid,
          messageChannel: websocketMessage.data.channel,
          pathfinderBotBehaviors: pathfinderBot.behaviors.length,
          messagingMethod: 'websocketSimulation'
        };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        };
      }
    });
    
    if (!messageResult.success) {
      console.error('❌ Message simulation failed:', messageResult.error);
      if (messageResult.stack) {
        console.error('Stack trace:', messageResult.stack);
      }
    }
    
    expect(messageResult.success).toBe(true);
    console.log('✅ Message simulation completed successfully');
    console.log('📋 Message details:', messageResult);
    
    // Wait a moment for the message to be processed and GoTo behavior to be created
    console.log('⏳ Waiting for message processing and GoTo behavior creation...');
    await page.waitForTimeout(3000);
    
    // Verify that the GoTo behavior was created - the original source uses GoTo constructor
    // which doesn't call gameLogger.actorGoto, but we should see behavior changes
    const behaviorResult = await page.evaluate(() => {
      const game = (window as any).game;
      if (!game || !game.users || !game.users.actors) {
        return { success: false, error: 'Game or actors not available' };
      }
      
      const actors = Object.values(game.users.actors);
      const pathfinderBot = actors.find((actor: any) => actor.username === 'PathfinderBot') as any;
      
      if (!pathfinderBot) {
        return { success: false, error: 'PathfinderBot not found' };
      }
      
      // Get detailed behavior information
      const behaviorDetails = pathfinderBot.behaviors.map((b: any) => ({
        name: b.constructor.name,
        target: b.target ? {
          username: b.target.username,
          position: b.target.position
        } : 'no target',
        actor: b.actor ? b.actor.username : 'no actor'
      }));
      
      // Check distance between actors to understand why GoTo might not trigger
      const messageSender = actors.find((actor: any) => actor.username === 'MessageSender') as any;
      const distance = messageSender ? 
        Math.sqrt(Math.pow(pathfinderBot.position.x - messageSender.position.x, 2) + 
                  Math.pow(pathfinderBot.position.y - messageSender.position.y, 2)) : -1;
      
      return {
        success: true,
        behaviorCount: pathfinderBot.behaviors.length,
        behaviors: pathfinderBot.behaviors.map((b: any) => b.constructor.name),
        behaviorDetails: behaviorDetails,
        hasGoToBehavior: pathfinderBot.behaviors.some((b: any) => b.constructor.name === 'GoTo'),
        position: pathfinderBot.position,
        destination: pathfinderBot.destination,
        isMoving: !!pathfinderBot.destination,
        presence: pathfinderBot.presence,
        lastMessage: pathfinderBot.lastMessage,
        distance: distance,
        messageSenderPosition: messageSender ? messageSender.position : null,
        underneath: pathfinderBot.underneath ? pathfinderBot.underneath() : false
      };
    });
    
    console.log('🔍 Detailed behavior analysis:');
    console.log('📋 Behavior result:', JSON.stringify(behaviorResult, null, 2));
    
    expect(behaviorResult.success).toBe(true);
    
    if (!behaviorResult.hasGoToBehavior) {
      console.log('❌ GoTo behavior was NOT created. Debugging info:');
      console.log(`   - Distance between actors: ${behaviorResult.distance}`);
      console.log(`   - PathfinderBot presence: ${behaviorResult.presence}`);
      console.log(`   - PathfinderBot lastMessage:`, behaviorResult.lastMessage);
      console.log(`   - PathfinderBot underneath: ${behaviorResult.underneath}`);
      console.log(`   - Current behaviors:`, behaviorResult.behaviorDetails);
      
      // The GoTo behavior should be created if distance >= 3 and actor is online
      // Let's check if the conditions in onMessage are being met
      if (behaviorResult.distance !== undefined && behaviorResult.distance < 3) {
        console.log('🔍 Distance is less than 3 - this may explain why GoTo was not created');
      }
      if (behaviorResult.presence !== 'online') {
        console.log('🔍 Actor is not online - this may explain why GoTo was not created');
      }
      if (behaviorResult.underneath) {
        console.log('🔍 Actor has something underneath - this may explain why GoTo was not created');
      }
    }
    
    expect(behaviorResult.hasGoToBehavior).toBe(true);
    console.log('✅ GoTo behavior successfully created through message trigger');
    console.log('📋 Behavior details:', behaviorResult);
    
    // Wait for movement to complete - PathfinderBot should move toward MessageSender
    console.log('⏳ Waiting for PathfinderBot movement toward MessageSender...');
    
    // Check position every 2 seconds to see progress
    let attempts = 0;
    const maxAttempts = 5; // 10 seconds total
    let currentPosition;
    
    do {
      await page.waitForTimeout(2000);
      attempts++;
      
      currentPosition = await page.evaluate(() => {
        const game = (window as any).game;
        if (!game || !game.users || !game.users.actors) {
          return null;
        }
        
        const actors = Object.values(game.users.actors);
        const pathfinderBot = actors.find((actor: any) => actor.username === 'PathfinderBot') as any;
        const messageSender = actors.find((actor: any) => actor.username === 'MessageSender') as any;
        
        if (!pathfinderBot || !messageSender) {
          return null;
        }
        
        return {
          pathfinderBot: {
            position: { x: pathfinderBot.position.x, y: pathfinderBot.position.y, z: pathfinderBot.position.z },
            isMoving: !!pathfinderBot.destination,
            behaviorsCount: pathfinderBot.behaviors.length,
            hasGoToBehavior: pathfinderBot.behaviors.some((b: any) => b.constructor.name === 'GoTo')
          },
          messageSender: {
            position: { x: messageSender.position.x, y: messageSender.position.y, z: messageSender.position.z }
          }
        };
      });
      
      if (currentPosition) {
        console.log(`📍 Position check ${attempts}/${maxAttempts}:`);
        console.log(`    PathfinderBot: (${currentPosition.pathfinderBot.position.x}, ${currentPosition.pathfinderBot.position.y}, ${currentPosition.pathfinderBot.position.z})`);
        console.log(`    MessageSender: (${currentPosition.messageSender.position.x}, ${currentPosition.messageSender.position.y}, ${currentPosition.messageSender.position.z})`);
        console.log(`    Moving: ${currentPosition.pathfinderBot.isMoving}, GoTo: ${currentPosition.pathfinderBot.hasGoToBehavior}`);
        
        // Break if PathfinderBot is adjacent to MessageSender (GoTo behavior targets adjacent positions)
        const distance = Math.abs(currentPosition.pathfinderBot.position.x - currentPosition.messageSender.position.x) + 
                        Math.abs(currentPosition.pathfinderBot.position.y - currentPosition.messageSender.position.y);
        if (distance <= 1) {
          console.log('✅ PathfinderBot reached adjacent position to MessageSender!');
          break;
        }
      }
      
    } while (attempts < maxAttempts);
    
    // Verify final position by getting the current actor state
    const finalPosition = await page.evaluate(() => {
      const game = (window as any).game;
      if (!game || !game.users || !game.users.actors) {
        return { success: false, error: 'Game or actors not available' };
      }
      
      const actors = Object.values(game.users.actors);
      const pathfinderBot = actors.find((actor: any) => actor.username === 'PathfinderBot') as any;
      const messageSender = actors.find((actor: any) => actor.username === 'MessageSender') as any;
      
      if (!pathfinderBot || !messageSender) {
        return { success: false, error: 'Actors not found' };
      }
      
      const distance = Math.abs(pathfinderBot.position.x - messageSender.position.x) + 
                      Math.abs(pathfinderBot.position.y - messageSender.position.y);
      
      return {
        success: true,
        pathfinderBot: {
          position: { x: pathfinderBot.position.x, y: pathfinderBot.position.y, z: pathfinderBot.position.z },
          username: pathfinderBot.username,
          uid: pathfinderBot.uid,
          isMoving: !!pathfinderBot.destination,
          behaviorsCount: pathfinderBot.behaviors.length,
          facing: pathfinderBot.facing
        },
        messageSender: {
          position: { x: messageSender.position.x, y: messageSender.position.y, z: messageSender.position.z },
          username: messageSender.username
        },
        distance: distance,
        isAdjacent: distance <= 1
      };
    });
    
    expect(finalPosition.success).toBe(true);
    console.log('📍 Final positions:');
    if (finalPosition.success && finalPosition.pathfinderBot && finalPosition.messageSender) {
      console.log(`    PathfinderBot: (${finalPosition.pathfinderBot.position.x}, ${finalPosition.pathfinderBot.position.y}, ${finalPosition.pathfinderBot.position.z})`);
      console.log(`    MessageSender: (${finalPosition.messageSender.position.x}, ${finalPosition.messageSender.position.y}, ${finalPosition.messageSender.position.z})`);
      console.log(`    Distance: ${finalPosition.distance}, Adjacent: ${finalPosition.isAdjacent}`);
      
      // Verify the actor moved closer to or adjacent to MessageSender
      // GoTo behavior targets adjacent positions, so distance should be 1 or less
      expect(finalPosition.isAdjacent).toBe(true);
      console.log(`✅ PathfinderBot successfully moved to adjacent position near MessageSender`);
      
      // Verify actor is not still moving
      expect(finalPosition.pathfinderBot.isMoving).toBe(false);
      
      // Note: GoTo behavior is automatically removed when movement completes successfully
      // So behaviorsCount might be 0, which is expected behavior
      console.log(`📊 Final behavior count: ${finalPosition.pathfinderBot.behaviorsCount} (GoTo behavior auto-removes on completion)`);
    } else {
      throw new Error('Failed to get final position data');
    }
    
    console.log(`✅ PathfinderBot successfully moved toward MessageSender through message-triggered pathfinding`);
    console.log(`📊 Message-triggered pathfinding validation complete - GoTo behavior verified`);
    
    // Print browser logs if there were any errors or warnings
    const browserErrors = gameUtils.getBrowserErrors();
    if (browserErrors.length > 0) {
      console.log('\n🚨 Browser Errors Found:');
      gameUtils.printBrowserErrors();
    }
    
    const browserLogs = gameUtils.getBrowserLogs();
    const warnings = browserLogs.filter(log => log.type === 'warning');
    if (warnings.length > 0) {
      console.log('\n⚠️ Browser Warnings:');
      warnings.forEach(log => {
        console.log(`    [${log.type}] ${log.text} (${log.location})`);
      });
    }
    
    // Verify world generation data for context
    const worldData = getWorldGenerationData(gameUtils);
    if (worldData) {
      expect(worldData.totalTiles).toBeGreaterThan(0);
      expect(worldData.spawnablePositions).toBeGreaterThan(0);
    } else {
      console.warn('⚠️ World generation data not available for verification');
    }
    
    console.log('🎉 Message-triggered pathfinding test completed successfully');
  });
});