/**
 * MSW (Mock Service Worker) handlers for API mocking
 * Used primarily in E2E tests
 */

/**
 * Get the init script string to inject MockWebSocket into the page
 * Use this with page.addInitScript() before navigating to the page
 * 
 * Example:
 * ```typescript
 * await page.addInitScript(getMockWebSocketScript());
 * ```
 */
export function getMockWebSocketScript() {
  return () => {
    console.log('🔧 [INIT SCRIPT] Starting WebSocket mock setup');
    
    // Create mock WebSocket that will intercept messages
    class MockWebSocket {
      readyState: number = 1; // OPEN
      private listeners: { [key: string]: Function[] } = {};
      private messageHandlers: Function[] = [];
      
      constructor(url: string) {
        console.log('🔌 [MOCK WS] MockWebSocket constructor called for URL:', url);
        
        // Simulate connection opening
        setTimeout(() => {
          console.log('✓ [MOCK WS] Triggering open event');
          if (this.listeners['open']) {
            this.listeners['open'].forEach((fn: Function) => fn(new Event('open')));
          }
          
          // Send server-list to client
          setTimeout(() => {
            console.log('📥 [MOCK WS] Sending server-list');
            this.triggerMessage({
              type: 'server-list',
              data: {
                'mock-server': {
                  id: 'mock-test',
                  name: 'Mock Test Server',
                  passworded: false
                }
              }
            });
          }, 50);
        }, 50);
      }
      
      send(data: string) {
        console.log('📤 [MOCK WS] Client sent:', data);
        
        try {
          const message = JSON.parse(data);
          
          // When client sends 'connect' message, respond with server-join
          if (message.type === 'connect') {
            console.log('🎯 [MOCK WS] Received CONNECT - sending server-join');
            
            setTimeout(() => {
              const serverJoinMsg = {
                type: 'server-join',
                data: {
                  request: { server: message.data.server || 'mock-test' },
                  serverName: 'Mock Test Server',
                  users: {
                    'mock-user-1': {
                      uid: 'mock-user-1',
                      username: 'MockActor1',
                      roleColor: '#FF5733',
                      presence: 'online'
                    },
                    'mock-user-2': {
                      uid: 'mock-user-2',
                      username: 'MockActor2',
                      roleColor: '#33FF57',
                      presence: 'online'
                    },
                    'mock-user-3': {
                      uid: 'mock-user-3',
                      username: 'MockActor3',
                      roleColor: '#3357FF',
                      presence: 'online'
                    }
                  }
                }
              };
              console.log('📥 [MOCK WS] Sending server-join with 3 mock actors');
              this.triggerMessage(serverJoinMsg);
            }, 100);
          }
        } catch (error) {
          console.error('❌ [MOCK WS] Error parsing message:', error);
        }
      }
      
      addEventListener(event: string, callback: Function) {
        if (event === 'message') {
          this.messageHandlers.push(callback);
        } else {
          if (!this.listeners[event]) {
            this.listeners[event] = [];
          }
          this.listeners[event].push(callback);
        }
      }
      
      removeEventListener(event: string, callback: Function) {
        if (event === 'message') {
          const idx = this.messageHandlers.indexOf(callback);
          if (idx > -1) this.messageHandlers.splice(idx, 1);
        } else if (this.listeners[event]) {
          const idx = this.listeners[event].indexOf(callback);
          if (idx > -1) this.listeners[event].splice(idx, 1);
        }
      }
      
      close() {
        console.log('🔌 [MOCK WS] Connection closed');
      }
      
      dispatchEvent(event: Event) {
        return true;
      }
      
      private triggerMessage(data: any) {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify(data)
        });
        
        this.messageHandlers.forEach((handler) => {
          try {
            handler(messageEvent);
          } catch (error) {
            console.error('❌ [MOCK WS] Error in message handler:', error);
          }
        });
      }
    }
    
    // Replace the global WebSocket with our mock
    (window as any).WebSocket = MockWebSocket;
    console.log('✓ [INIT SCRIPT] WebSocket replaced with MockWebSocket');
  };
}

/**
 * Get the init script to mock world generation with a simple square island
 * Use this with page.addInitScript() before navigating to the page
 * 
 * This works by intercepting the geometry module's noise generation functions
 * to return flat terrain, creating a simple square island instead of complex terrain.
 * 
 * @param size - The size of the square world (e.g., 4 for a 4x4 world)
 * 
 * Example:
 * ```typescript
 * await page.addInitScript(getMockWorldGenerationScript(4));
 * ```
 */
export function getMockWorldGenerationScript(size: number = 4) {
  return () => {
    console.log(`🌍 [INIT SCRIPT] Setting up ${size}x${size} mock world generation`);
    
    // Set mock flags for potential use
    (window as any).__mockWorldGeneration = true;
    (window as any).__mockWorldSize = size;
    
    // Create a mock noise map generator that returns flat terrain
    const createMockNoiseMap = (mapSize: number) => {
      const result: number[][] = [];
      for (let i = 0; i < mapSize; i++) {
        result[i] = [];
        for (let j = 0; j < mapSize; j++) {
          // Return low values (0.1) to create land everywhere
          // This creates a simple square island
          result[i][j] = 0.1;
        }
      }
      return result;
    };
    
    // We'll monkey-patch the geometry module when it's loaded
    // Store the original define/require if they exist
    const originalWindow = window as any;
    
    // Hook into module loading to intercept geometry module
    if (originalWindow.require && originalWindow.require.defined) {
      const checkAndPatch = () => {
        try {
          // Try to get the geometry module if it's already defined
          const geometryModule = originalWindow.require('script/common/geometry');
          if (geometryModule && geometryModule.generateNoiseMap) {
            console.log('🎯 [INIT SCRIPT] Found geometry module, patching generateNoiseMap');
            const originalGenerateNoiseMap = geometryModule.generateNoiseMap;
            
            geometryModule.generateNoiseMap = function(mapSize: number) {
              console.log(`🌍 [MOCK] generateNoiseMap called with size ${mapSize}, returning mock flat terrain`);
              return createMockNoiseMap(mapSize);
            };
            
            console.log('✓ [INIT SCRIPT] generateNoiseMap patched successfully');
          }
        } catch (e) {
          // Module not loaded yet, that's okay
        }
      };
      
      // Try to patch immediately
      checkAndPatch();
      
      // Also try again after a short delay in case modules load later
      setTimeout(checkAndPatch, 100);
      setTimeout(checkAndPatch, 500);
    }
    
    // Alternative: Store the mock function for manual use if needed
    (window as any).__mockNoiseMap = createMockNoiseMap;
    
    console.log(`✓ [INIT SCRIPT] Mock world generation configured for ${size}x${size} world`);
  };
}
