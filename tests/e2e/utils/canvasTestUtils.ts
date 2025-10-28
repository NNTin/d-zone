/**
 * @file Log-based test utilities for canvas game testing
 * @description Provides utilities for testing canvas-based games through console log analysis
 */

import { Page, expect } from '@playwright/test';

export interface GameLogEvent {
  timestamp: number;
  level: 'info' | 'debug' | 'warn' | 'error';
  category: string;
  event: string;
  data?: any;
}

export interface BrowserConsoleLog {
  timestamp: number;
  type: 'log' | 'info' | 'warning' | 'error' | 'debug' | 'trace' | 'dir' | 'dirxml' | 'table' | 'clear' | 'startGroup' | 'startGroupCollapsed' | 'endGroup' | 'assert' | 'profile' | 'profileEnd' | 'count' | 'timeEnd';
  text: string;
  location?: string;
  args?: any[];
}

export interface ActorState {
  uid: string;
  username: string;
  x: number;
  y: number;
  z: number;
  facing?: string;
  animation?: string;
  visible?: boolean;
}

export interface GameState {
  initialized: boolean;
  canvasSize?: { width: number; height: number };
  actorCount: number;
  actors: ActorState[];
  currentUser?: string;
}

/**
 * Enhanced test utilities for canvas-based game testing
 */
export class CanvasGameTestUtils {
  private logs: GameLogEvent[] = [];
  private browserLogs: BrowserConsoleLog[] = [];
  private gameState: GameState = {
    initialized: false,
    actorCount: 0,
    actors: []
  };

  constructor(private page: Page) {}

  /**
   * Start capturing console logs from the game
   */
  async startLogCapture(): Promise<void> {
    this.logs = [];
    this.browserLogs = [];
    
    // Capture console messages
    this.page.on('console', (msg) => {
      const timestamp = Date.now();
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      
      // Capture ALL browser console logs for debugging
      this.browserLogs.push({
        timestamp,
        type: type as any,
        text,
        location: location ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : undefined,
        args: msg.args().map(arg => arg.toString())
      });
      
      // Log important browser console messages to test output
      if (type === 'error') {
        console.error(`🔴 [BROWSER ERROR] ${text}`);
        if (location) {
          console.error(`   at ${location.url}:${location.lineNumber}:${location.columnNumber}`);
        }
      } else if (type === 'warning') {
        console.warn(`🟡 [BROWSER WARN] ${text}`);
      } else if (text.includes('crash') || text.includes('error') || text.includes('exception')) {
        console.log(`🔍 [BROWSER] ${type.toUpperCase()}: ${text}`);
      }
      
      try {
        // Look for structured game logs (JSON format)
        if (text.startsWith('[GAME_LOG]')) {
          const pinoLogData = JSON.parse(text.replace('[GAME_LOG]', '').trim());
          
          // Extract the actual log data from pino's structure
          // pino logs have this structure: { ts, messages: [data, message], bindings, level }
          const messages = pinoLogData.messages || [];
          if (messages.length > 0) {
            const logData = messages[0]; // First message contains the structured data
            if (logData.category && logData.event) {
              // Extract category and event, everything else goes in data
              const { category, event, timestamp, ...data } = logData;
              
              // Extract log level from the pino log structure
              // The pino log level can be extracted from the log event or default to 'info'
              let level = 'info';
              if (pinoLogData.level !== undefined) {
                if (typeof pinoLogData.level === 'object' && pinoLogData.level.label) {
                  // Pino level object with label property
                  level = pinoLogData.level.label;
                } else if (typeof pinoLogData.level === 'number') {
                  // Map pino level numbers to level names
                  // 10: trace, 20: debug, 30: info, 40: warn, 50: error, 60: fatal
                  const levelMap: { [key: number]: string } = {
                    10: 'trace',
                    20: 'debug', 
                    30: 'info',
                    40: 'warn',
                    50: 'error',
                    60: 'fatal'
                  };
                  level = levelMap[pinoLogData.level] || 'info';
                } else if (typeof pinoLogData.level === 'string') {
                  // Direct string level
                  level = pinoLogData.level;
                }
              }
              
              this.logs.push({
                timestamp: Date.now(),
                level: level as 'info' | 'debug' | 'warn' | 'error',
                category,
                event,
                data
              });
              
              // Update game state based on log events
              this.updateGameState(logData);
            }
          }
        }
      } catch (error) {
        // Ignore non-JSON logs
      }
    });

    // Capture page errors (unhandled JavaScript errors)
    this.page.on('pageerror', (error) => {
      const timestamp = Date.now();
      console.error(`💥 [PAGE ERROR] ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      
      // Add as a browser log entry
      this.browserLogs.push({
        timestamp,
        type: 'error',
        text: `PAGE ERROR: ${error.message}`,
        location: error.stack ? error.stack.split('\n')[1] : undefined,
        args: [error.stack]
      });
    });

    // Capture request failures
    this.page.on('requestfailed', (request) => {
      const timestamp = Date.now();
      const failure = request.failure();
      console.warn(`🔗 [REQUEST FAILED] ${request.url()}: ${failure?.errorText || 'Unknown error'}`);
      
      // Add as a browser log entry
      this.browserLogs.push({
        timestamp,
        type: 'warning',
        text: `REQUEST FAILED: ${request.url()} - ${failure?.errorText || 'Unknown error'}`,
        location: request.url()
      });
    });
  }

  /**
   * Wait for the game to be fully initialized
   */
  async waitForGameInitialization(timeout: number = 10000): Promise<void> {
    await expect.poll(
      () => this.gameState.initialized,
      {
        message: 'Game should be initialized',
        timeout
      }
    ).toBe(true);
  }

  /**
   * Wait for a specific number of actors to be present
   */
  async waitForActorCount(expectedCount: number, timeout: number = 5000): Promise<void> {
    await expect.poll(
      () => this.gameState.actorCount,
      {
        message: `Expected ${expectedCount} actors`,
        timeout
      }
    ).toBe(expectedCount);
  }

  /**
   * Wait for a specific actor to appear
   */
  async waitForActor(username: string, timeout: number = 5000): Promise<ActorState> {
    await expect.poll(
      () => this.gameState.actors.find(a => a.username === username),
      {
        message: `Actor ${username} should be present`,
        timeout
      }
    ).toBeTruthy();

    return this.gameState.actors.find(a => a.username === username)!;
  }

  /**
   * Verify actor position
   */
  async expectActorPosition(username: string, x: number, y: number): Promise<void> {
    const actor = await this.waitForActor(username);
    expect(actor.x).toBe(x);
    expect(actor.y).toBe(y);
  }

  /**
   * Verify actor movement occurred
   */
  async expectActorMoved(username: string, fromX: number, fromY: number): Promise<void> {
    const actor = await this.waitForActor(username);
    expect(actor.x !== fromX || actor.y !== fromY).toBe(true);
  }

  /**
   * Wait for a specific game event to occur
   */
  async waitForGameEvent(category: string, event: string, timeout: number = 5000): Promise<GameLogEvent> {
    await expect.poll(
      () => this.logs.find(log => log.category === category && log.event === event),
      {
        message: `Event ${category}:${event} should occur`,
        timeout
      }
    ).toBeTruthy();

    return this.logs.find(log => log.category === category && log.event === event)!;
  }

  /**
   * Verify that only one nametag is visible
   */
  async expectSingleNametagVisible(): Promise<void> {
    const nametagEvents = this.logs.filter(log => 
      log.category === 'nametag' && log.event === 'show'
    );
    const hideEvents = this.logs.filter(log => 
      log.category === 'nametag' && log.event === 'hide'
    );

    // Should have one more show than hide events (one visible)
    expect(nametagEvents.length - hideEvents.length).toBe(1);
  }

  /**
   * Get all logs of a specific category
   */
  getLogsByCategory(category: string): GameLogEvent[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Get all captured logs
   */
  getAllLogs(): GameLogEvent[] {
    return [...this.logs];
  }

  /**
   * Get recent logs (last N seconds)
   */
  getRecentLogs(seconds: number = 5): GameLogEvent[] {
    const cutoff = Date.now() - (seconds * 1000);
    return this.logs.filter(log => log.timestamp > cutoff);
  }

  /**
   * Get all browser console logs
   */
  getBrowserLogs(): BrowserConsoleLog[] {
    return [...this.browserLogs];
  }

  /**
   * Get browser console logs by type
   */
  getBrowserLogsByType(type: 'log' | 'info' | 'warning' | 'error' | 'debug'): BrowserConsoleLog[] {
    return this.browserLogs.filter(log => log.type === type);
  }

  /**
   * Get browser console errors
   */
  getBrowserErrors(): BrowserConsoleLog[] {
    return this.getBrowserLogsByType('error');
  }

  /**
   * Get browser console warnings
   */
  getBrowserWarnings(): BrowserConsoleLog[] {
    return this.browserLogs.filter(log => log.type === 'warning');
  }

  /**
   * Get recent browser logs (last N seconds)
   */
  getRecentBrowserLogs(seconds: number = 10): BrowserConsoleLog[] {
    const cutoff = Date.now() - (seconds * 1000);
    return this.browserLogs.filter(log => log.timestamp > cutoff);
  }

  /**
   * Print all browser console logs to test output
   */
  printBrowserLogs(): void {
    console.log('\n📋 Browser Console Logs:');
    this.browserLogs.forEach((log, index) => {
      const time = new Date(log.timestamp).toTimeString().slice(0, 8);
      const emoji = log.type === 'error' ? '🔴' : log.type === 'warning' ? '🟡' : '🔵';
      console.log(`${emoji} [${time}] ${log.type.toUpperCase()}: ${log.text}`);
      if (log.location) {
        console.log(`   at ${log.location}`);
      }
    });
  }

  /**
   * Print browser errors and warnings to test output
   */
  printBrowserErrors(): void {
    const errors = this.getBrowserErrors();
    const warnings = this.getBrowserWarnings();
    
    if (errors.length > 0) {
      console.log('\n🔴 Browser Errors:');
      errors.forEach(log => {
        const time = new Date(log.timestamp).toTimeString().slice(0, 8);
        console.log(`[${time}] ${log.text}`);
        if (log.location) {
          console.log(`   at ${log.location}`);
        }
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n🟡 Browser Warnings:');
      warnings.forEach(log => {
        const time = new Date(log.timestamp).toTimeString().slice(0, 8);
        console.log(`[${time}] ${log.text}`);
        if (log.location) {
          console.log(`   at ${log.location}`);
        }
      });
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ No browser errors or warnings found');
    }
  }

  /**
   * Clear captured logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Simulate mouse hover over coordinates
   */
  async hoverOnCanvas(x: number, y: number): Promise<void> {
    // The game creates multiple canvas elements with IDs like main1, main2, main3, main4
    // We need to find the one that's currently visible (highest z-index)
    const canvas = this.page.locator('canvas[id^="main"]').first();
    await canvas.hover({
      position: { x, y }
    });
  }

  /**
   * Simulate click on canvas coordinates
   */
  async clickOnCanvas(x: number, y: number): Promise<void> {
    // The game creates multiple canvas elements with IDs like main1, main2, main3, main4
    // We need to find the one that's currently visible (highest z-index)
    const canvas = this.page.locator('canvas[id^="main"]').first();
    await canvas.click({
      position: { x, y }
    });
  }

  /**
   * Take a screenshot for debugging
   */
  async takeDebugScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ 
      path: `test-results/debug-${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  /**
   * Update internal game state based on log events
   */
  private updateGameState(logData: any): void {
    switch (logData.category) {
      case 'game':
        if (logData.event === 'initialized') {
          this.gameState.initialized = true;
          // Extract canvas size from the log data
          if (logData.width && logData.height) {
            this.gameState.canvasSize = { 
              width: logData.width, 
              height: logData.height 
            };
          }
        }
        break;

      case 'actor':
        if (logData.event === 'spawned') {
          const actor: ActorState = {
            uid: logData.data.uid,
            username: logData.data.username,
            x: logData.data.x,
            y: logData.data.y,
            z: logData.data.z || 0,
            visible: true
          };
          this.gameState.actors.push(actor);
          this.gameState.actorCount = this.gameState.actors.length;
        } else if (logData.event === 'moved') {
          const actor = this.gameState.actors.find(a => a.uid === logData.data.uid);
          if (actor) {
            actor.x = logData.data.x;
            actor.y = logData.data.y;
            actor.facing = logData.data.facing;
          }
        } else if (logData.event === 'removed') {
          this.gameState.actors = this.gameState.actors.filter(a => a.uid !== logData.data.uid);
          this.gameState.actorCount = this.gameState.actors.length;
        }
        break;

      case 'nametag':
        if (logData.event === 'show') {
          const actor = this.gameState.actors.find(a => a.uid === logData.data.actorUid);
          if (actor) {
            actor.visible = true;
          }
        } else if (logData.event === 'hide') {
          const actor = this.gameState.actors.find(a => a.uid === logData.data.actorUid);
          if (actor) {
            actor.visible = false;
          }
        }
        break;
    }
  }
}

/**
 * Test data builders for consistent test scenarios
 */
export class GameTestDataBuilder {
  static createActor(overrides: Partial<ActorState> = {}): ActorState {
    return {
      uid: `actor-${Math.random().toString(36).substr(2, 9)}`,
      username: `testuser${Math.floor(Math.random() * 1000)}`,
      x: Math.floor(Math.random() * 10),
      y: Math.floor(Math.random() * 10),
      z: 0,
      visible: true,
      ...overrides
    };
  }

  static createGameEvent(category: string, event: string, data?: any): GameLogEvent {
    return {
      timestamp: Date.now(),
      level: 'info',
      category,
      event,
      data
    };
  }
}

/**
 * Custom assertions for game testing
 */
export class GameAssertions {
  static async assertCanvasVisible(page: Page): Promise<void> {
    // The game creates multiple canvas elements with IDs like main1, main2, main3, main4
    // We need to find the one that's currently visible (highest z-index)
    const canvas = page.locator('canvas[id^="main"]').first();
    await expect(canvas).toBeVisible();
    
    // Verify canvas has actual dimensions
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
  }

  static async assertGameLoaded(gameUtils: CanvasGameTestUtils): Promise<void> {
    await gameUtils.waitForGameInitialization();
    const state = gameUtils.getGameState();
    expect(state.initialized).toBe(true);
  }

  static async assertActorInteraction(
    gameUtils: CanvasGameTestUtils, 
    interactionType: string
  ): Promise<void> {
    await gameUtils.waitForGameEvent('interaction', interactionType);
  }
}