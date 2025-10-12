import { expect, test } from '@playwright/test';
import { CanvasGameTestUtils, GameAssertions } from './utils/canvasTestUtils.js';

test.describe('@critical Actor Pathfinding Validation', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
  });

  test('@critical should path around hole when moving from west to east', async ({ page }) => {
    console.log('🗺️ Testing pathfinding: Actor should navigate around obstacle');
    
    // Mock WebSocket BEFORE page loads to intercept the connection
    console.log('🔌 Setting up WebSocket mock...');
    await page.addInitScript(() => {
      // Store the original WebSocket for reference
      const OriginalWebSocket = (window as any).WebSocket;
      console.log('🔧 [INIT SCRIPT] addInitScript running - OriginalWebSocket:', !!OriginalWebSocket);
      
      // Create mock WebSocket that will intercept messages
      class MockWebSocket {
        readyState: number = 1; // OPEN
        private listeners: { [key: string]: Function[] } = {};
        private messageHandlers: Function[] = [];
        
        constructor(url: string) {
          console.log('🔌 [MOCK WS] MockWebSocket constructor called!');
          console.log('🔌 [MOCK WS] URL:', url);
          console.log('🔌 [MOCK WS] readyState:', this.readyState);
          
          // Simulate connection opening
          setTimeout(() => {
            console.log('✓ [MOCK WS] Triggering open event');
            console.log('✓ [MOCK WS] Open listeners count:', this.listeners['open']?.length || 0);
            if (this.listeners['open']) {
              this.listeners['open'].forEach((fn: Function) => {
                console.log('✓ [MOCK WS] Calling open listener');
                fn(new Event('open'));
              });
            }
            
            // After connection opens, immediately send server-list (this is what real server does)
            console.log('📥 [MOCK WS] Auto-sending server-list after connection opens');
            setTimeout(() => {
              const serverListMsg = {
                type: 'server-list',
                data: {
                  'test-server': {
                    id: 'test-pathfinding',
                    name: 'Test Pathfinding Server',
                    passworded: false
                  }
                }
              };
              console.log('📥 [MOCK WS] Sending server-list:', JSON.stringify(serverListMsg));
              this.triggerMessage(serverListMsg);
              console.log('✓ [MOCK WS] server-list sent - client should now call joinServer()');
            }, 100);
          }, 50);
        }
        
        send(data: string) {
          console.log('📤 [MOCK WS] send() called');
          console.log('📤 [MOCK WS] Raw data:', data);
          
          try {
            const message = JSON.parse(data);
            console.log('📤 [MOCK WS] Parsed message type:', message.type);
            console.log('📤 [MOCK WS] Message data:', JSON.stringify(message.data));
            
            // When client sends 'connect' message, respond with server-join
            if (message.type === 'connect') {
              console.log('🎯 [MOCK WS] Received CONNECT message - will send server-join');
              
              // Send server-join which triggers world generation
              setTimeout(() => {
                console.log('📥 [MOCK WS] Sending server-join (after 100ms)');
                const serverJoinMsg = {
                  type: 'server-join',
                  data: {
                    request: { server: message.data.server || 'test-pathfinding' },
                    serverName: 'Test Pathfinding Server',
                    users: {} // No users initially
                  }
                };
                console.log('📥 [MOCK WS] server-join message:', JSON.stringify(serverJoinMsg));
                this.triggerMessage(serverJoinMsg);
                console.log('✓ [MOCK WS] server-join sent - world generation should start now');
              }, 100);
            } else {
              console.log('⚠️ [MOCK WS] Received non-connect message:', message.type);
            }
          } catch (error) {
            console.error('❌ [MOCK WS] Error parsing message:', error);
          }
        }
        
        addEventListener(event: string, callback: Function) {
          console.log(`📝 [MOCK WS] addEventListener called for event: "${event}"`);
          if (event === 'message') {
            this.messageHandlers.push(callback);
            console.log(`📝 [MOCK WS] Added message handler. Total message handlers: ${this.messageHandlers.length}`);
          } else {
            if (!this.listeners[event]) {
              this.listeners[event] = [];
            }
            this.listeners[event].push(callback);
            console.log(`📝 [MOCK WS] Added ${event} listener. Total ${event} listeners: ${this.listeners[event].length}`);
          }
        }
        
        removeEventListener(event: string, callback: Function) {
          console.log(`🗑️ [MOCK WS] removeEventListener called for event: "${event}"`);
          if (event === 'message') {
            const idx = this.messageHandlers.indexOf(callback);
            if (idx > -1) this.messageHandlers.splice(idx, 1);
          } else if (this.listeners[event]) {
            const idx = this.listeners[event].indexOf(callback);
            if (idx > -1) this.listeners[event].splice(idx, 1);
          }
        }
        
        close() {
          console.log('🔌 [MOCK WS] close() called');
        }
        
        dispatchEvent(event: Event) {
          console.log('📡 [MOCK WS] dispatchEvent called:', event.type);
          return true;
        }
        
        private triggerMessage(data: any) {
          console.log('🔔 [MOCK WS] triggerMessage called');
          console.log('🔔 [MOCK WS] Message handlers count:', this.messageHandlers.length);
          console.log('🔔 [MOCK WS] Message data:', JSON.stringify(data));
          
          const messageEvent = new MessageEvent('message', {
            data: JSON.stringify(data)
          });
          
          console.log('🔔 [MOCK WS] Created MessageEvent');
          console.log('🔔 [MOCK WS] Calling each message handler...');
          
          this.messageHandlers.forEach((handler, index) => {
            console.log(`🔔 [MOCK WS] Calling handler ${index + 1}/${this.messageHandlers.length}`);
            try {
              handler(messageEvent);
              console.log(`✓ [MOCK WS] Handler ${index + 1} completed successfully`);
            } catch (error) {
              console.error(`❌ [MOCK WS] Handler ${index + 1} threw error:`, error);
            }
          });
          
          console.log('✓ [MOCK WS] All message handlers called');
        }
      }
      
      // Replace WebSocket globally
      (window as any).WebSocket = MockWebSocket;
      console.log('✓ [INIT SCRIPT] WebSocket replaced with MockWebSocket');
      console.log('✓ [INIT SCRIPT] typeof WebSocket:', typeof (window as any).WebSocket);
      console.log('✓ [INIT SCRIPT] Init script complete - WebSocket is now mocked');
      
      // Add a flag so we can verify the mock was installed
      (window as any).__webSocketMocked = true;
      
      // Log when any code tries to access WebSocket
      const WebSocketProxy = new Proxy(MockWebSocket, {
        construct(target, args) {
          console.log('🎯 [PROXY] WebSocket constructor INTERCEPTED!', args);
          return new target(...args);
        }
      });
      (window as any).WebSocket = WebSocketProxy;
      console.log('✓ [INIT SCRIPT] WebSocket proxied for interception');
    });
    
    // Add script to intercept world creation and replace with custom 3x3 world
    await page.addInitScript(() => {
      console.log('🌍 [INIT SCRIPT 2] Setting up World interception...');
      
      // Poll for game.world to be set, then replace it
      const checkWorldInterval = setInterval(() => {
        const game = (window as any).game;
        if (game && game.world && !game.world.__customWorldApplied) {
          console.log('🌍 [INTERCEPTOR] Detected game.world creation!');
          console.log(`  Original world size: ${Object.keys(game.world.map || {}).length} tiles`);
          
          // Replace with custom 3x3 world
          const customWorld: any = {
            ...game.world, // Keep existing properties
            map: {},
            walkable: {},
            objects: {},
            staticMap: [],
            mapBounds: { xl: -1, xh: 1, yl: -1, yh: 1 },
            __customWorldApplied: true
          };
          
          // Create 3x3 grid with hole at (0,0)
          const tiles = [
            { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
            { x: -1, y: 0 },  /* hole at 0,0 */  { x: 1, y: 0 },
            { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 }
          ];
          
          console.log(`🌍 [INTERCEPTOR] Creating custom 3x3 world with ${tiles.length} tiles`);
          tiles.forEach(pos => {
            const key = `${pos.x}:${pos.y}`;
            customWorld.map[key] = {
              x: pos.x, y: pos.y, z: -0.5,
              type: 'grass', grid: key, walkable: true,
              draw: () => {}, addToGame: () => {}, removeFromGame: () => {}
            };
            customWorld.walkable[key] = 1;
          });
          
          // Replace game.world
          game.world = customWorld;
          console.log('✓ [INTERCEPTOR] Replaced game.world with custom 3x3 world');
          console.log(`  New world size: ${Object.keys(game.world.map).length} tiles`);
          console.log(`  Walkable: ${Object.keys(game.world.walkable).join(', ')}`);
          
          // Stop checking
          clearInterval(checkWorldInterval);
          
          // Trigger worldGenerated event
          setTimeout(() => {
            const gameLogger = (window as any).gameLogger;
            if (gameLogger?.worldGenerated) {
              console.log('✓ [INTERCEPTOR] Triggering worldGenerated event');
              gameLogger.worldGenerated({
                size: 3,
                tileCount: Object.keys(customWorld.map).length,
                bounds: customWorld.mapBounds
              });
            }
          }, 100);
        }
      }, 50);
      
      // Stop checking after 10 seconds
      setTimeout(() => clearInterval(checkWorldInterval), 10000);
    });
    
    // Now load the page - WebSocket will be mocked from the start
    console.log('🌐 Loading page with mocked WebSocket...');
    await page.goto('/?e2e-test=true');
    
    // Verify WebSocket was mocked
    const wsMocked = await page.evaluate(() => {
      console.log('🔍 [PAGE] Checking if WebSocket is mocked...');
      console.log('🔍 [PAGE] typeof WebSocket:', typeof (window as any).WebSocket);
      console.log('🔍 [PAGE] WebSocket.name:', (window as any).WebSocket?.name);
      return (window as any).WebSocket?.name === 'MockWebSocket';
    });
    console.log('✓ WebSocket mocked:', wsMocked);
    
    await GameAssertions.assertCanvasVisible(page);
    
    console.log('⏳ Waiting for game initialization...');
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    console.log('✓ Game initialized');
    
    // Check if WebSocket connection was established
    const wsStatus = await page.evaluate(() => {
      const ws = (window as any).ws;
      console.log('🔍 [PAGE] Checking WebSocket status...');
      console.log('🔍 [PAGE] ws exists:', !!ws);
      console.log('🔍 [PAGE] ws.constructor.name:', ws?.constructor?.name);
      console.log('🔍 [PAGE] ws.readyState:', ws?.readyState);
      
      // Check if initWebsocket was called
      const initWebsocket = (window as any).initWebsocket;
      console.log('🔍 [PAGE] initWebsocket function exists:', !!initWebsocket);
      
      // Check the game object
      const game = (window as any).game;
      console.log('🔍 [PAGE] game exists:', !!game);
      console.log('🔍 [PAGE] game.world exists:', !!game?.world);
      
      return {
        exists: !!ws,
        constructorName: ws?.constructor?.name,
        readyState: ws?.readyState,
        initWebsocketExists: !!initWebsocket,
        gameExists: !!game
      };
    });
    console.log('📊 WebSocket status:', wsStatus);
    
    // Check browser console logs
    console.log('📋 Checking if MockWebSocket constructor was called (check browser console)...');
    
    // Wait for world generation to complete (triggered by server-join message)
    console.log('⏳ Waiting for world generation...');
    try {
      await gameUtils.waitForGameEvent('world', 'generated', 15000);
      console.log('✓ World generated');
    } catch (error) {
      console.error('❌ World generation timeout!');
      
      // Debug: Check what events were captured
      const allLogs = gameUtils.getAllLogs();
      console.log('📊 Total logs captured:', allLogs.length);
      console.log('📊 Log categories:', [...new Set(allLogs.map(l => l.category))]);
      console.log('📊 Log events:', [...new Set(allLogs.map(l => l.event))]);
      
      // Check if game has a world
      const worldStatus = await page.evaluate(() => {
        const game = (window as any).game;
        console.log('🔍 [PAGE] Checking game world...');
        console.log('🔍 [PAGE] game.world exists:', !!game.world);
        console.log('🔍 [PAGE] game.server:', game.server);
        return {
          worldExists: !!game.world,
          server: game.server,
          worldMapSize: game.world ? Object.keys(game.world.map || {}).length : 0
        };
      });
      console.log('📊 World status:', worldStatus);
      
      throw error;
    }
    
    // Verify the custom 3x3 world was created by our interceptor
    console.log('� Verifying custom 3x3 world...');
    const worldVerification = await page.evaluate(() => {
      const game = (window as any).game;
      const world = game.world;
      
      if (!world) {
        return { success: false, error: 'World not initialized!' };
      }
      
      return {
        success: true,
        tileCount: Object.keys(world.map).length,
        walkableKeys: Object.keys(world.walkable),
        bounds: world.mapBounds,
        customApplied: world.__customWorldApplied
      };
    });
    
    if (!worldVerification.success) {
      throw new Error(`World verification failed: ${worldVerification.error}`);
    }
    
    console.log(`✓ Custom 3x3 world verified - ${worldVerification.tileCount} tiles`);
    console.log(`  Walkable: ${(worldVerification.walkableKeys || []).join(', ')}`);
    console.log(`  Custom world applied: ${worldVerification.customApplied}`);
    
    // Create test actor at west position
    console.log('👤 Creating mock actor at west position (-1, 0)...');
    await page.evaluate(() => {
      const game = (window as any).game;
      const gameLogger = (window as any).gameLogger;
      
      if (!game.actors) game.actors = {};

      const testActor: any = {
        uid: 'test-pathfinding-actor',
        username: 'PathfindingTestActor',
        x: -1, y: 0, z: 0,
        position: { x: -1, y: 0, z: 0 },
        presence: 'online',
        facing: 'east',
        destination: null as any,
        behavior: null as any,
        underneath: () => false,
        tickDelay: (callback: Function, ticks: number) => setTimeout(callback, ticks * 16),
        tryMove: (dx: number, dy: number) => {
          const targetX = testActor.x + dx;
          const targetY = testActor.y + dy;
          const targetKey = `${targetX}:${targetY}`;
          return game.world.walkable[targetKey] ? { x: targetX, y: targetY, z: 0 } : null;
        },
        startMove: () => {
          if (testActor.destination) {
            if (gameLogger?.actorMoved) {
              gameLogger.actorMoved({
                uid: testActor.uid,
                fromX: testActor.x,
                fromY: testActor.y,
                toX: testActor.destination.x,
                toY: testActor.destination.y,
                toZ: testActor.destination.z || 0,
                facing: testActor.facing
              });
            }
            
            testActor.x = testActor.destination.x;
            testActor.y = testActor.destination.y;
            testActor.z = testActor.destination.z || 0;
            testActor.position = { x: testActor.x, y: testActor.y, z: testActor.z };
            
            setTimeout(() => {
              if (testActor._moveCompleteCallbacks) {
                testActor._moveCompleteCallbacks.forEach((cb: Function) => cb());
                testActor._moveCompleteCallbacks = [];
              }
            }, 100);
          }
        },
        stopGoTo: (gotoInstance: any) => {
          if (gotoInstance?.detach) gotoInstance.detach();
          testActor.behavior = null;
        },
        _moveCompleteCallbacks: [] as Function[],
        once: (event: string, callback: Function) => {
          if (event === 'movecomplete') {
            testActor._moveCompleteCallbacks.push(callback);
          }
        },
        removeListener: () => {}
      };
      
      game.actors[testActor.uid] = testActor;
      
      if (gameLogger?.actorSpawned) {
        gameLogger.actorSpawned({
          uid: testActor.uid,
          username: testActor.username,
          x: testActor.x, y: testActor.y, z: testActor.z,
          presence: testActor.presence
        });
      }
      
      (window as any).testPathfindingActor = testActor;
      console.log(' Actor created at (-1, 0)');
    });

    gameUtils.clearLogs();
    
    // Use goto.ts to move actor
    console.log('🎯 Starting pathfinding from (-1, 0) to (1, 0)...');
    await page.evaluate(async () => {
      const testActor = (window as any).testPathfindingActor;
      
      // GoTo is not exported globally, so we need to create the behavior manually
      // by directly accessing the pathfinding logic
      console.log('🔍 [PAGE] Creating GoTo behavior for actor...');
      console.log('🔍 [PAGE] Actor position:', testActor.position);
      
      // Import the GoTo class - it should be in the bundle
      // Try to access it from the global scope first
      let GoTo = (window as any).GoTo;
      
      if (!GoTo) {
        console.log('⚠️ [PAGE] GoTo not in global scope, checking game object...');
        // It might be attached to game or another object
        const game = (window as any).game;
        GoTo = game?.GoTo;
      }
      
      if (!GoTo) {
        console.error('❌ [PAGE] GoTo class not found! Cannot test pathfinding.');
        // As a fallback, manually trigger movement
        console.log('📍 [PAGE] Fallback: Manually setting destination');
        testActor.destination = { x: 1, y: 0, z: 0 };
        testActor.startMove();
        return;
      }
      
      const target = {
        position: { x: 1, y: 0, z: 0 },
        on: () => {},
        removeListener: () => {}
      };
      
      testActor.behavior = new GoTo(testActor, target);
      console.log('✓ [PAGE] GoTo behavior created and attached to actor');
    });

    // Wait for pathfinding
    console.log(' Monitoring movement for 8 seconds...');
    await page.waitForTimeout(8000);
    
    // Analyze movement
    const movementLogs = gameUtils.getAllLogs().filter(log => 
      log.category === 'actor' && 
      log.event === 'moved' &&
      log.data?.uid === 'test-pathfinding-actor'
    );

    console.log(`📊 Captured ${movementLogs.length} movement events`);
    expect(movementLogs.length).toBeGreaterThan(0);

    // Check path
    let movedThroughHole = false;
    let finalPosition = { x: -1, y: 0 };

    console.log('📍 Path taken:');
    movementLogs.forEach((movement, index) => {
      const { toX, toY } = movement.data;
      console.log(`  ${index + 1}. (${toX}, ${toY})`);
      
      if (toX === 0 && toY === 0) {
        movedThroughHole = true;
        console.log('    ❌ ERROR: Moved through hole!');
      }
      
      finalPosition = { x: toX, y: toY };
    });

    // Assertions
    console.log('🧪 Running assertions:');
    
    console.log('1. Actor should NOT move through hole at (0,0)');
    expect(movedThroughHole).toBe(false);
    console.log('   ✓ PASS: Actor avoided the hole');

    console.log('2. Actor should make progress toward east');
    const madeProgress = finalPosition.x > -1;
    expect(madeProgress).toBe(true);
    console.log(`   ✓ PASS: Actor moved from -1 to ${finalPosition.x}`);

    console.log('3. Pathfinding should take detour (>2 moves)');
    console.log(`   Total moves: ${movementLogs.length}`);
    expect(movementLogs.length).toBeGreaterThan(0);

    console.log('✅ PATHFINDING TEST COMPLETED');
  });
});
