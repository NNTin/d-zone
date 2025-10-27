/**
 * Game Logger Module for E2E Testing
 * 
 * This module provides structured logging for the D-Zone game to enable
 * comprehensive E2E testing through log-based verification.
 * 
 * Features:
 * - Structured logging with pino for consistent format
 * - Game-specific event categories (actor, nametag, websocket, etc.)
 * - Environment-aware logging (disabled in production)
 * - E2E test integration through structured events
 * - Performance tracking and metrics
 */

import pino from 'pino';

// Environment detection
const isProduction = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
const isTesting = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.CI === 'true');
const isE2ETesting = typeof window !== 'undefined' && window.location.search.includes('e2e-test=true');

// Logger configuration
const logger = pino({
  level: isProduction ? 'warn' : 'debug',
  browser: {
    serialize: true,
    transmit: {
      level: 'debug',
      send: function (level, logEvent) {
        // In browser, emit structured logs for E2E test capture
        if (typeof window !== 'undefined' && (isTesting || isE2ETesting)) {
          console.log(`[GAME_LOG] ${JSON.stringify(logEvent)}`);
        }
      }
    }
  },
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});

/**
 * Game-specific logger with structured event categories
 */
class GameLogger {
  private enabled: boolean = !isProduction;
  
  constructor(private baseLogger: pino.Logger) {}

  /**
   * Enable or disable logging (useful for production)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  // ===========================================
  // GAME LIFECYCLE EVENTS
  // ===========================================

  /**
   * Game initialization event
   */
  gameInitialized(data: { width: number; height: number; version?: string }): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'game',
      event: 'initialized',
      timestamp: Date.now(),
      ...data
    }, 'Game initialized');
  }

  /**
   * Initial canvas draw complete
   */
  initialDraw(): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'game',
      event: 'initial_draw',
      timestamp: Date.now()
    }, 'Initial draw complete');
  }

  /**
   * Game reset event
   */
  gameReset(): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'game',
      event: 'reset',
      timestamp: Date.now()
    }, 'Game reset');
  }

  // ===========================================
  // WORLD GENERATION EVENTS
  // ===========================================

  /**
   * World generation completed
   */
  worldGenerated(data: {
    totalTiles: number;
    spawnablePositions: number;
    worldSize: number;
    worldRadius: number;
    mapBounds: { xl: number; yl: number; xh: number; yh: number };
    mainIslandSize?: number;
    totalIslands?: number;
    spawnPositions?: string[];
  }): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'world',
      event: 'generated',
      timestamp: Date.now(),
      ...data
    }, `World generated: ${data.totalTiles} tiles, ${data.spawnablePositions} spawn positions`);
  }

  /**
   * World spawn position analysis completed
   */
  worldSpawnAnalysis(data: {
    totalPositions: number;
    validSpawnPositions: number;
    invalidSpawnPositions: number;
    validPositions: string[];
    invalidPositions: string[];
  }): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'world',
      event: 'spawn_analysis',
      timestamp: Date.now(),
      ...data
    }, `Spawn analysis: ${data.validSpawnPositions} valid, ${data.invalidSpawnPositions} invalid positions`);
  }

  /**
   * World tile map created
   */
  worldTileMap(data: {
    totalTiles: number;
    uniqueTileCodes: number;
    tilesByCode: Record<string, number>;
    gridTileTypes: Record<string, string>;
    tileMap: Record<string, { 
      tileCode: string; 
      x: number; 
      y: number; 
      z: number;
      grid: string;
    }>;
  }): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'world',
      event: 'tile_map',
      timestamp: Date.now(),
      ...data
    }, `Tile map created: ${data.totalTiles} tiles, ${data.uniqueTileCodes} unique tile codes`);
  }

  // ===========================================
  // ACTOR SYSTEM EVENTS
  // ===========================================

  /**
   * Actor spawned in the world
   */
  actorSpawned(data: { 
    uid: string; 
    username: string; 
    x: number; 
    y: number; 
    z?: number;
    roleColor?: string;
    presence?: string;
  }): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'actor',
      event: 'spawned',
      timestamp: Date.now(),
      ...data
    }, `Actor spawned: ${data.username} at (${data.x}, ${data.y})`);
  }

  /**
   * Actor movement event
   */
  actorMoved(data: { 
    uid: string; 
    username: string;
    fromX: number;
    fromY: number;
    fromZ: number;
    toX: number; 
    toY: number; 
    toZ: number;
    movementType: 'relative' | 'absolute';
    facing?: string;
  }): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'actor',
      event: 'moved',
      timestamp: Date.now(),
      ...data
    }, `Actor moved: ${data.username} from (${data.fromX}, ${data.fromY}, ${data.fromZ}) to (${data.toX}, ${data.toY}, ${data.toZ})`);
  }

  /**
   * Actor goto command issued
   */
  actorGoto(data: {
    uid?: string;
    username: string;
    targetX: number;
    targetY: number;
  }): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'actor',
      event: 'goto',
      timestamp: Date.now(),
      ...data
    }, `Actor goto command: ${data.username} -> (${data.targetX}, ${data.targetY})`);
  }

  /**
   * Actor removed from world
   */
  actorRemoved(data: { uid: string; username?: string }): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'actor',
      event: 'removed',
      timestamp: Date.now(),
      ...data
    }, `Actor removed: ${data.username || data.uid}`);
  }

  /**
   * Actor status/presence update
   */
  actorUpdated(data: { 
    uid: string; 
    username?: string;
    presence?: string;
    roleColor?: string;
    changes?: string[];
  }): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'actor',
      event: 'updated',
      timestamp: Date.now(),
      ...data
    }, `Actor updated: ${data.username || data.uid}`);
  }

  /**
   * Actor animation started
   */
  actorAnimationStarted(data: {
    uid: string;
    username: string;
    animationType: 'hopping' | 'talking' | 'idle' | 'wander';
    state: string;
    facing: string;
    frame: number;
    destination?: { x: number; y: number; z: number };
  }): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'actor',
      event: 'animationStarted',
      timestamp: Date.now(),
      ...data
    }, `Actor animation started: ${data.username} - ${data.animationType} (${data.state})`);
  }

  /**
   * Actor animation finished
   */
  actorAnimationFinished(data: {
    uid: string;
    username: string;
    animationType: 'hopping' | 'talking' | 'idle' | 'wander';
    state: string;
    facing: string;
    finalFrame: number;
    position: { x: number; y: number; z: number };
  }): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'actor',
      event: 'animationFinished',
      timestamp: Date.now(),
      ...data
    }, `Actor animation finished: ${data.username} - ${data.animationType} at (${data.position.x}, ${data.position.y})`);
  }

  /**
   * Actor sprite rendered to canvas
   */
  actorSpriteRendered(data: {
    uid: string;
    username: string;
    state: string;
    facing: string;
    frame: number;
    spriteMetrics: {
      x: number;
      y: number;
      w: number;
      h: number;
      ox: number;
      oy: number;
    };
    image: string | string[];
    presence: string;
    talking: boolean;
    moving: boolean;
  }): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'actor',
      event: 'spriteRendered',
      timestamp: Date.now(),
      ...data
    }, `Actor sprite rendered: ${data.username} - ${data.state}/${data.facing} (${data.presence})`);
  }

  // ===========================================
  // NAMETAG SYSTEM EVENTS
  // ===========================================

  /**
   * Nametag shown for actor
   */
  nametagShow(actorUid: string, username?: string): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'nametag',
      event: 'show',
      timestamp: Date.now(),
      actorUid,
      username
    }, `Nametag shown: ${username || actorUid}`);
  }

  /**
   * Nametag hidden for actor
   */
  nametagHide(actorUid: string, username?: string): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'nametag',
      event: 'hide',
      timestamp: Date.now(),
      actorUid,
      username
    }, `Nametag hidden: ${username || actorUid}`);
  }

  /**
   * Multiple nametags resolved (only one shown)
   */
  nametagResolved(visibleActorUid: string, hiddenActorUids: string[]): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'nametag',
      event: 'resolved',
      timestamp: Date.now(),
      visibleActorUid,
      hiddenActorUids,
      totalCount: hiddenActorUids.length + 1
    }, `Nametag conflict resolved: showing ${visibleActorUid}, hiding ${hiddenActorUids.length} others`);
  }

  // ===========================================
  // WEBSOCKET EVENTS
  // ===========================================

  /**
   * WebSocket connection established
   */
  websocketConnected(url?: string): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'websocket',
      event: 'connected',
      timestamp: Date.now(),
      url
    }, `WebSocket connected: ${url || 'unknown'}`);
  }

  /**
   * WebSocket disconnected
   */
  websocketDisconnected(reason?: string): void {
    if (!this.enabled) return;
    this.baseLogger.warn({
      category: 'websocket',
      event: 'disconnected',
      timestamp: Date.now(),
      reason
    }, `WebSocket disconnected: ${reason || 'unknown'}`);
  }

  /**
   * WebSocket message received
   */
  websocketMessageReceived(data: { type: string; [key: string]: any }): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'websocket',
      event: 'message_received',
      timestamp: Date.now(),
      messageType: data.type,
      dataSize: JSON.stringify(data).length
    }, `WebSocket message: ${data.type}`);
  }

  /**
   * WebSocket message sent
   */
  websocketMessageSent(data: { type: string; [key: string]: any }): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'websocket',
      event: 'message_sent',
      timestamp: Date.now(),
      messageType: data.type,
      dataSize: JSON.stringify(data).length
    }, `WebSocket sent: ${data.type}`);
  }

  /**
   * Server joined successfully
   */
  serverJoined(serverId: string, serverName?: string): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'websocket',
      event: 'server_joined',
      timestamp: Date.now(),
      serverId,
      serverName
    }, `Joined server: ${serverName || serverId}`);
  }

  // ===========================================
  // UI EVENTS
  // ===========================================

  /**
   * UI panel opened
   */
  uiPanelOpened(panelType: string): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'ui',
      event: 'panel_opened',
      timestamp: Date.now(),
      panelType
    }, `UI panel opened: ${panelType}`);
  }

  /**
   * UI panel closed
   */
  uiPanelClosed(panelType: string): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'ui',
      event: 'panel_closed',
      timestamp: Date.now(),
      panelType
    }, `UI panel closed: ${panelType}`);
  }

  /**
   * Button clicked
   */
  buttonClicked(buttonType: string, buttonText?: string): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'ui',
      event: 'button_clicked',
      timestamp: Date.now(),
      buttonType,
      buttonText
    }, `Button clicked: ${buttonType} (${buttonText || 'no text'})`);
  }

  // ===========================================
  // CANVAS INTERACTION EVENTS
  // ===========================================

  /**
   * Canvas hover event
   */
  canvasHover(x: number, y: number, actorUid?: string): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'canvas',
      event: 'hover',
      timestamp: Date.now(),
      x,
      y,
      actorUid
    }, `Canvas hover: (${x}, ${y}) ${actorUid ? `on actor ${actorUid}` : ''}`);
  }

  /**
   * Canvas click event
   */
  canvasClick(x: number, y: number, actorUid?: string): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'canvas',
      event: 'click',
      timestamp: Date.now(),
      x,
      y,
      actorUid
    }, `Canvas click: (${x}, ${y}) ${actorUid ? `on actor ${actorUid}` : ''}`);
  }

  /**
   * Canvas resize event
   */
  canvasResize(width: number, height: number): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'canvas',
      event: 'resize',
      timestamp: Date.now(),
      width,
      height
    }, `Canvas resized: ${width}x${height}`);
  }

  // ===========================================
  // AUTHENTICATION EVENTS
  // ===========================================

  /**
   * Discord OAuth login attempt
   */
  discordLoginAttempt(): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'auth',
      event: 'discord_login_attempt',
      timestamp: Date.now()
    }, 'Discord login attempt started');
  }

  /**
   * Discord OAuth login success
   */
  discordLoginSuccess(username: string): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'auth',
      event: 'discord_login_success',
      timestamp: Date.now(),
      username
    }, `Discord login successful: ${username}`);
  }

  /**
   * Discord OAuth login error
   */
  discordLoginError(error: string): void {
    if (!this.enabled) return;
    this.baseLogger.error({
      category: 'auth',
      event: 'discord_login_error',
      timestamp: Date.now(),
      error
    }, `Discord login failed: ${error}`);
  }

  /**
   * Discord logout
   */
  discordLogout(): void {
    if (!this.enabled) return;
    this.baseLogger.info({
      category: 'auth',
      event: 'discord_logout',
      timestamp: Date.now()
    }, 'Discord logout');
  }

  // ===========================================
  // PERFORMANCE EVENTS
  // ===========================================

  /**
   * Performance timing measurement
   */
  performanceMetric(metric: string, value: number, unit: string = 'ms'): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'performance',
      event: 'metric',
      timestamp: Date.now(),
      metric,
      value,
      unit
    }, `Performance: ${metric} = ${value}${unit}`);
  }

  /**
   * Frame rate measurement
   */
  frameRate(fps: number): void {
    if (!this.enabled) return;
    this.baseLogger.debug({
      category: 'performance',
      event: 'frame_rate',
      timestamp: Date.now(),
      fps
    }, `FPS: ${fps}`);
  }

  // ===========================================
  // GENERIC LOGGING METHODS
  // ===========================================

  /**
   * Info level logging
   */
  info(message: string, data?: any): void {
    if (!this.enabled) return;
    this.baseLogger.info(data || {}, message);
  }

  /**
   * Debug level logging
   */
  debug(message: string, data?: any): void {
    if (!this.enabled) return;
    this.baseLogger.debug(data || {}, message);
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: any): void {
    if (!this.enabled) return;
    this.baseLogger.warn(data || {}, message);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: any): void {
    if (!this.enabled) return;
    this.baseLogger.error(error || {}, message);
  }
}

// Create and export the game logger instance
export const gameLogger = new GameLogger(logger);

// Expose gameLogger on window for E2E tests
if (typeof window !== 'undefined' && (window as any).__E2E_TEST_MODE) {
  (window as any).gameLogger = gameLogger;
  console.log('✅ [E2E] gameLogger exposed on window.gameLogger');
}

// Export the base logger for special cases
export { logger as baseLogger };

// Export types for TypeScript support
    export type {
    GameLogger
  };

