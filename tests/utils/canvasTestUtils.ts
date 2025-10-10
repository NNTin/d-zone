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
    
    this.page.on('console', (msg) => {
      try {
        const text = msg.text();
        
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
              this.logs.push({
                timestamp: Date.now(),
                level: 'info',
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
   * Get recent logs (last N seconds)
   */
  getRecentLogs(seconds: number = 5): GameLogEvent[] {
    const cutoff = Date.now() - (seconds * 1000);
    return this.logs.filter(log => log.timestamp > cutoff);
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