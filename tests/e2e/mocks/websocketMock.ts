/**
 * WebSocket Mock for E2E Tests
 * 
 * This module provides WebSocket mocking functionality for testing actor spawning
 * and server communication without requiring actual WebSocket connections.
 */

import type { MockServerConfig } from './actorMock.js';

/** 
 * Creates a basic WebSocket mock with 3 hardcoded actors
 * 
 * This function returns an initialization script that replaces the global WebSocket
 * with a mock implementation that simulates server communication and actor spawning.
 * 
 * @returns Function to be used with page.addInitScript()
 * 
 * @example
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
 * Creates a configurable WebSocket mock that allows custom actors
 * 
 * This function returns an initialization script that creates a mock WebSocket
 * with a configurable set of actors, allowing for flexible testing scenarios.
 * 
 * @returns Function to be used with page.addInitScript() that accepts MockServerConfig
 * 
 * @example
 * ```typescript
 * const config = {
 *   actors: [
 *     { uid: 'test-1', username: 'Player1', roleColor: '#FF0000' },
 *     { uid: 'test-2', username: 'Player2', roleColor: '#00FF00' }
 *   ]
 * };
 * await page.addInitScript(getMockWebSocketScriptWithActors(), config);
 * ```
 */
export function getMockWebSocketScriptWithActors() {
  return (config: MockServerConfig) => {
    console.log('🔧 [INIT SCRIPT] Starting configurable WebSocket mock setup');
    console.log(`🎭 [MOCK WS] Configured ${config.actors.length} actors:`, config.actors.map(a => a.username).join(', '));
    
    // Create mock WebSocket that will intercept messages
    class MockWebSocket {
      readyState: number = 1; // OPEN
      private listeners: { [key: string]: Function[] } = {};
      private messageHandlers: Function[] = [];
      
      constructor(url: string) {
        console.log('🔌 [MOCK WS] MockWebSocket constructor called for URL:', url);
        
        // Store reference to this WebSocket instance globally for test access
        (window as any).__mockWebSocket = this;
        
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
                [config.serverId || 'mock-server']: {
                  id: config.serverId || 'mock-test',
                  name: config.serverName || 'Mock Test Server',
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
            console.log('🎯 [MOCK WS] Received CONNECT - sending server-join with configured actors');
            
            setTimeout(() => {
              // Convert actor array to users object
              const users: { [key: string]: any } = {};
              config.actors.forEach(actor => {
                users[actor.uid] = {
                  uid: actor.uid,
                  username: actor.username,
                  roleColor: actor.roleColor,
                  presence: actor.presence || 'online',
                  // Note: preferredSpawnArea is stored but actual spawn location 
                  // is still determined by the world's randomEmptyGrid() method
                  preferredSpawnArea: actor.preferredSpawnArea
                };
              });
              
              const serverJoinMsg = {
                type: 'server-join',
                data: {
                  request: { server: message.data.server || config.serverId || 'mock-test' },
                  serverName: config.serverName || 'Mock Test Server',
                  users
                }
              };
              console.log(`📥 [MOCK WS] Sending server-join with ${config.actors.length} configured actors`);
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
      
      // Public method to simulate incoming messages from tests
      public simulateIncomingMessage(data: any) {
        console.log('📨 [MOCK WS] Simulating incoming message:', data);
        this.triggerMessage(data);
      }
    }
    
    // Replace the global WebSocket with our mock
    (window as any).WebSocket = MockWebSocket;
    
    // Add global helper function for tests to send mock messages
    (window as any).__simulateWebSocketMessage = function(messageData: any) {
      const mockWS = (window as any).__mockWebSocket;
      if (mockWS && mockWS.simulateIncomingMessage) {
        mockWS.simulateIncomingMessage(messageData);
        return true;
      } else {
        console.error('❌ [MOCK WS] No MockWebSocket instance available for message simulation');
        return false;
      }
    };
    
    console.log('✓ [INIT SCRIPT] WebSocket replaced with MockWebSocket and message simulation enabled');
  };
}