# Copilot Instructions for D-Zone

## Project Overview

D-Zone is a TypeScript-based isometric simulation that visualizes Discord users as autonomous agents in a virtual world. This is a client-only fork that connects to a separate Python backend ([nntin/d-back](https://github.com/nntin/d-back)) via WebSocket.

## Critical Architecture Patterns

### ES Module Structure
- **Entry Point**: `src/main.ts` orchestrates initialization: preloader → game engine → Discord OAuth → WebSocket
- **Module Pattern**: All files use ES modules (`import`/`export`) with `.js` extensions in imports for runtime compatibility
- **Build System**: esbuild bundles to `dist/static/bundle.js` with development/production modes

### WebSocket Communication
- **Fallback Strategy**: URL parameter → current hostname path → Hermes server (`wss://hermes.nntin.xyz/dzone`)
- **Message Types**: `server-list`, `server-join`, `presence`, `message`, `error`, `update-clientid`
- **Authentication**: Discord OAuth tokens sent only for passworded servers
- **Connection Lifecycle**: Automatic cleanup of event listeners to prevent memory leaks

### Authentication Flow
- **Discord OAuth**: Popup-based implicit flow with `discord-callback.html`
- **State Management**: localStorage persistence with expiration checks
- **Dynamic Client ID**: Server can update OAuth client ID via `update-clientid` message
- **Server Access**: Only passworded servers require Discord authentication

## Testing System

### Tag-Based Test Execution
Tags control which tests run in different environments:
- `@critical` - External failures, system outages (local + CI)
- `@normal` - Standard functionality (local + CI) 
- `@long` - Performance tests (CI only)
- `@active` - Actively maintained tests (local + CI)
- `@inactive` - WIP/unstable tests (excluded everywhere)
- `@dback` - Backend integration tests (local only with `PW_INCLUDE_DBACK=1`)

### Testing Architecture
- **Unit Tests**: Vitest with jsdom, mocked dependencies in `tests/unit/`
- **E2E Tests**: Playwright with real browser, log-based verification in `tests/e2e/`
- **Canvas Testing**: `CanvasGameTestUtils` for game state verification via structured logging
- **Mock Strategy**: MSW for API mocking, Vitest for browser API mocking

## Development Workflows

### Essential Commands
```bash
npm run dev              # Concurrent build watch + dev server
npm run build:prod       # Production build for deployment
npm run test             # Unit tests + E2E tests  
npm run test:unit:watch  # Development unit testing
npm run test:e2e:debug   # Step-through E2E debugging
```

### Testing Workflows
- **Local Development**: Run `@critical|@normal|@active` tests, exclude `@long` and `@dback`
- **CI Environment**: Include `@long` tests, exclude `@dback` backend integration
- **Backend Integration**: Use `PW_INCLUDE_DBACK=1` to test against real d-back server

### VS Code Tasks
Access via `Ctrl+Shift+P` → "Tasks: Run Task":
- "Start Development Server" - Background dev server with hot reload
- "Watch Unit Tests" - Auto-rerun unit tests on file changes
- "Debug E2E Tests" - Playwright inspector for step-through debugging

## Code Patterns

### Structured Logging
All testable events use `gameLogger` with categories:
```typescript
gameLogger.gameInitialized({ width, height, version });
gameLogger.actorSpawned(actorId, { x, y, username });
gameLogger.websocketConnected(url);
```
This enables log-based verification in E2E tests without DOM inspection.

### User Data Normalization
Handle both d-back (nested) and legacy (flat) user data formats:
```typescript
function normalizeUserData(user: any): any {
  // Check for nested user.user.id format (d-back)
  if (user?.user?.id && user?.user?.username) {
    return { uid: user.user.id, username: user.user.username, status: user.status || 'online' };
  }
  // Handle flat format
  return user;
}
```

### Error Handling & Fallbacks
- **WebSocket**: Multiple connection strategies with automatic fallback
- **Authentication**: Graceful degradation when Discord OAuth unavailable
- **Server Selection**: URL params → localStorage → 'default' server

## Integration Points

### Backend Communication
- **WebSocket URL**: Configurable via `?socketURL=` parameter or automatic discovery
- **Server List**: Received via `server-list` message, includes passworded server flags
- **User Presence**: Real-time updates via `presence` messages with status normalization

### External Dependencies
- **Discord OAuth**: Dynamic client ID configuration from backend
- **Asset Loading**: Preloader handles sprites and animations before game init
- **Canvas Rendering**: Isometric 2D engine with layered rendering system

## Testing Conventions

### Unit Test Structure
```typescript
describe('@normal Component Name', () => {
  beforeEach(() => vi.clearAllMocks());
  
  it('@active should handle normal case', () => {
    // Arrange-Act-Assert pattern
  });
});
```

### E2E Test Structure  
```typescript
test.describe('@critical Feature Name', () => {
  test('@critical @active should complete user workflow', async ({ page }) => {
    await gameUtils.waitForGameEvent('game', 'initialized');
    // Use log-based verification, not DOM inspection
  });
});
```

When working on this codebase, prioritize understanding the WebSocket message flow and authentication patterns, as these drive most functionality. Use the structured logging system for debugging and testing verification.