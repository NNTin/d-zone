/**
 * @file Game logging utility for testability
 * @description Provides structured logging for E2E test verification
 */

export interface GameLogData {
  category: string;
  event: string;
  data?: any;
}

/**
 * Game logger that emits structured logs for testing
 */
export class GameLogger {
  private static instance: GameLogger;
  private enabled: boolean = true;

  static getInstance(): GameLogger {
    if (!GameLogger.instance) {
      GameLogger.instance = new GameLogger();
    }
    return GameLogger.instance;
  }

  /**
   * Enable or disable logging (useful for production)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Log a structured game event
   */
  log(category: string, event: string, data?: any): void {
    if (!this.enabled) return;

    const logData: GameLogData = {
      category,
      event,
      data
    };

    // Emit structured log that tests can capture
    console.log(`[GAME]${JSON.stringify(logData)}`);
  }

  // Convenience methods for common game events

  /**
   * Log game initialization events
   */
  gameInitialized(canvasSize?: { width: number; height: number }): void {
    this.log('game', 'initialized', { canvasSize });
  }

  gameStarted(): void {
    this.log('game', 'started');
  }

  gameError(error: string): void {
    this.log('game', 'error', { error });
  }

  /**
   * Log WebSocket events
   */
  websocketConnected(): void {
    this.log('websocket', 'connected');
  }

  websocketDisconnected(): void {
    this.log('websocket', 'disconnected');
  }

  websocketReconnected(): void {
    this.log('websocket', 'reconnected');
  }

  websocketError(error: string): void {
    this.log('websocket', 'error', { error });
  }

  /**
   * Log actor events
   */
  actorSpawned(actor: { uid: string; username: string; x: number; y: number; z?: number }): void {
    this.log('actor', 'spawned', actor);
  }

  actorMoved(actor: { uid: string; x: number; y: number; facing?: string }): void {
    this.log('actor', 'moved', actor);
  }

  actorRemoved(uid: string): void {
    this.log('actor', 'removed', { uid });
  }

  actorTalking(uid: string, message: string): void {
    this.log('actor', 'talking', { uid, message });
  }

  /**
   * Log nametag events
   */
  nametagShow(actorUid: string): void {
    this.log('nametag', 'show', { actorUid });
  }

  nametagHide(actorUid: string): void {
    this.log('nametag', 'hide', { actorUid });
  }

  nametagMultiple(visibleUids: string[]): void {
    this.log('nametag', 'multiple_visible', { visibleUids });
  }

  /**
   * Log animation events
   */
  animationStart(type: string, actorUid?: string): void {
    this.log('animation', `${type}_start`, { actorUid });
  }

  animationEnd(type: string, actorUid?: string): void {
    this.log('animation', `${type}_end`, { actorUid });
  }

  /**
   * Log rendering events
   */
  initialDraw(): void {
    this.log('render', 'initial_draw');
  }

  frameRendered(fps?: number): void {
    this.log('render', 'frame', { fps });
  }

  /**
   * Log movement events
   */
  moveToSpeaker(targetUid: string): void {
    this.log('movement', 'move_to_speaker', { targetUid });
  }

  pathfindingStart(from: { x: number; y: number }, to: { x: number; y: number }): void {
    this.log('pathfinding', 'start', { from, to });
  }

  pathfindingComplete(path: { x: number; y: number }[]): void {
    this.log('pathfinding', 'complete', { path });
  }

  /**
   * Log interaction events
   */
  interaction(type: string, data?: any): void {
    this.log('interaction', type, data);
  }

  /**
   * Log chat events
   */
  messageSent(content: string, targetUid?: string): void {
    this.log('chat', 'message_sent', { content, targetUid });
  }

  messageReceived(content: string, fromUid: string): void {
    this.log('chat', 'message_received', { content, fromUid });
  }

  /**
   * Log performance events
   */
  performanceMetric(metric: string, value: number): void {
    this.log('performance', metric, { value });
  }

  /**
   * Log error events
   */
  apiFailure(endpoint: string, status: number): void {
    this.log('error', 'api_failure', { endpoint, status });
  }

  renderError(error: string): void {
    this.log('error', 'render_error', { error });
  }
}

// Export singleton instance
export const gameLogger = GameLogger.getInstance();