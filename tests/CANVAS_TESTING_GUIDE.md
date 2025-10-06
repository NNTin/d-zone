# Canvas Game E2E Testing Strategy

## Overview

This document outlines our **log-based E2E testing approach** for canvas-based games where traditional DOM testing is insufficient.

## Why Log-Based Testing?

**Traditional E2E Problem**: Canvas games render everything to a single `<canvas>` element, making it impossible to verify game state through DOM inspection.

**Our Solution**: Structured logging that emits testable events, allowing E2E tests to verify game behavior through console log analysis.

## Architecture

```
Game Code                    Test Utils                    E2E Tests
├─ gameLogger.log()  ───────> CanvasGameTestUtils  ────> test assertions
├─ Actor interactions        ├─ Log capture               ├─ Actor behavior tests  
├─ Movement events           ├─ Game state tracking       ├─ Nametag tests
├─ Animation events          ├─ Event waiting             ├─ Movement tests
└─ WebSocket events          └─ Custom assertions         └─ Performance tests
```

## Implementation Steps

### 1. Add Logging to Game Code

Import and use the game logger in your game modules:

```typescript
// In any game module
import { gameLogger } from '../common/gameLogger.js';

// Log game events
gameLogger.gameInitialized({ width: 800, height: 600 });
gameLogger.actorSpawned({ uid: 'actor-123', username: 'player1', x: 5, y: 5 });
gameLogger.nametagShow('actor-123');
gameLogger.actorMoved({ uid: 'actor-123', x: 6, y: 5, facing: 'right' });
```

### 2. Example Integration Points

**Game Initialization** (`src/main.ts`):
```typescript
import { gameLogger } from './script/common/gameLogger.js';

function initGame(images: Record<string, HTMLCanvasElement>): void {
    // ... existing init code ...
    
    gameLogger.gameInitialized({ 
        width: canvas.width, 
        height: canvas.height 
    });
    gameLogger.initialDraw();
}
```

**Actor System** (`src/script/actors/actor.ts`):
```typescript
import { gameLogger } from '../common/gameLogger.js';

class Actor {
    spawn(): void {
        // ... spawn logic ...
        gameLogger.actorSpawned({
            uid: this.uid,
            username: this.username,
            x: this.x,
            y: this.y,
            z: this.z
        });
    }
    
    moveTo(x: number, y: number): void {
        // ... movement logic ...
        gameLogger.actorMoved({
            uid: this.uid,
            x: this.x,
            y: this.y,
            facing: this.facing
        });
    }
}
```

**Nametag System** (wherever nametags are handled):
```typescript
import { gameLogger } from '../common/gameLogger.js';

function showNametag(actorUid: string): void {
    // ... show nametag logic ...
    gameLogger.nametagShow(actorUid);
}

function hideNametag(actorUid: string): void {
    // ... hide nametag logic ...
    gameLogger.nametagHide(actorUid);
}
```

**WebSocket Connection** (`src/main.ts`):
```typescript
import { gameLogger } from './script/common/gameLogger.js';

ws.onopen = () => {
    gameLogger.websocketConnected();
};

ws.onclose = () => {
    gameLogger.websocketDisconnected();
};
```

## Writing Tests

### Test Structure

```typescript
import { expect, test } from '@playwright/test';
import { CanvasGameTestUtils, GameAssertions } from './utils/canvasTestUtils.js';

test.describe('@critical Actor Nametag System', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
    await page.goto('/');
    await GameAssertions.assertCanvasVisible(page);
    await GameAssertions.assertGameLoaded(gameUtils);
  });

  test('@critical should show only one nametag at a time', async ({ page }) => {
    // Wait for actors to spawn
    await gameUtils.waitForActorCount(2);
    
    const actors = gameUtils.getGameState().actors;
    
    // Hover over first actor
    await gameUtils.hoverOnCanvas(actors[0].x * 32, actors[0].y * 32);
    await gameUtils.waitForGameEvent('nametag', 'show');
    
    // Hover over second actor
    await gameUtils.hoverOnCanvas(actors[1].x * 32, actors[1].y * 32);
    await gameUtils.waitForGameEvent('nametag', 'show');
    
    // Verify only one nametag is visible
    await gameUtils.expectSingleNametagVisible();
  });
});
```

### Available Test Utilities

**Wait for Events**:
- `await gameUtils.waitForGameEvent('nametag', 'show')`
- `await gameUtils.waitForGameEvent('actor', 'moved')`
- `await gameUtils.waitForGameEvent('websocket', 'connected')`

**Game State Assertions**:
- `await gameUtils.waitForActorCount(2)`
- `await gameUtils.waitForActor('username')`
- `await gameUtils.expectActorPosition('username', 5, 5)`
- `await gameUtils.expectActorMoved('username', 4, 4)`

**Canvas Interactions**:
- `await gameUtils.hoverOnCanvas(x, y)`
- `await gameUtils.clickOnCanvas(x, y)`

**Log Analysis**:
- `gameUtils.getLogsByCategory('nametag')`
- `gameUtils.getRecentLogs(5)` // last 5 seconds
- `gameUtils.clearLogs()`

## Benefits of This Approach

✅ **Accurate Testing**: Tests verify actual game logic, not just UI state  
✅ **Canvas Compatible**: Works with any canvas-based rendering  
✅ **Comprehensive Coverage**: Can test interactions, animations, state changes  
✅ **Debugging Friendly**: Rich log data helps troubleshoot test failures  
✅ **Performance Insights**: Can capture timing and performance metrics  
✅ **Maintainable**: Clear separation between game logic and test verification  

## Production Considerations

**Logging Control**:
```typescript
// Disable in production
if (process.env.NODE_ENV === 'production') {
    gameLogger.setEnabled(false);
}
```

**Log Filtering**:
```typescript
// Only enable specific categories in production
gameLogger.log('error', 'critical_failure', data); // Always log errors
gameLogger.log('debug', 'minor_event', data);      // Skip in production
```

## Migration from DOM-based Tests

**Old Approach**:
```typescript
// This doesn't work for canvas games
await expect(page.locator('[data-testid="actor"]')).toBeVisible();
```

**New Approach**:
```typescript
// This verifies actual game state
await gameUtils.waitForActorCount(1);
const actor = await gameUtils.waitForActor('username');
expect(actor.x).toBe(5);
```

## Running Tests

```bash
# Start dev server (serves the game with logging enabled)
npm run dev

# Run E2E tests that use log analysis
npm run test:e2e

# Debug with visible browser
npm run test:e2e:headed
```

## Next Steps

1. **Add logging to game initialization** in `src/main.ts`
2. **Add actor logging** in `src/script/actors/`
3. **Add nametag logging** in your nametag rendering code
4. **Add WebSocket logging** in connection handling
5. **Run tests** to verify log capture works
6. **Expand coverage** by adding more specific game events

This approach gives us robust, maintainable E2E testing for canvas-based games!