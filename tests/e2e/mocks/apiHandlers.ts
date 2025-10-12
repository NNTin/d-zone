/**
 * MSW (Mock Service Worker) handlers for API mocking
 * Used primarily in E2E tests
 */

// Export world generation mock
export { getMockWorldGenerationScript } from './worldGenerationMock.js';

/** 
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
