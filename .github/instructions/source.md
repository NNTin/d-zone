# Source Code Structure Documentation

## Source Code Location

**Primary Source Directory:** `src/`

**Entry Point:** `src/main.ts`

## Directory Structure and Responsibilities

### Core Game Systems (`src/`)

**`main.ts`** - Application Entry Point
- Game initialization and bootstrapping
- WebSocket connection management with multiple fallback strategies
- Discord OAuth setup and user authentication
- Preloader coordination and asset loading
- Global event handling and cleanup

**`gameLogger.ts`** - Structured Logging System
- E2E testing support through structured event logging
- Categories: game, world, actor, nametag, websocket, ui, canvas, auth, performance
- Methods: `gameInitialized()`, `actorSpawned()`, `actorMoved()`, `worldGenerated()`, etc.
- Enables log-based verification in E2E tests

**`websocket-utils.ts`** - WebSocket Utilities
- WebSocket helper functions and utilities
- Connection management utilities

### Actor System (`src/script/actors/`)

**`actor.ts`** - Base Actor Class
- Core Actor class for all game entities
- Position, movement, and state management
- Sprite rendering and animation coordination
- Event emission for actor lifecycle events

**`users.ts`** - Users Class (Actor Manager)
- Manages all actors in the game world
- Actor spawning, updating, and cleanup
- Collision detection and interaction handling
- Actor collection management and querying

**`sheet.ts`** - Actor Sprite Sheet Management
- Actor sprite sheet loading and management
- Animation frame coordination
- Sprite rendering utilities for actors

**`pathfinder.ts`** - Pathfinding Logic
- A* pathfinding algorithm implementation
- Navigation mesh and obstacle avoidance
- Movement path calculation and optimization

**`placeholder.ts`** - Placeholder Actor Implementation
- Default/fallback actor implementation
- Basic actor behavior for testing

**Actor Behaviors (`src/script/actors/behaviors/`):**

**`wander.ts`** - Random Wandering Behavior
- Implements random movement patterns
- Boundary awareness and collision avoidance
- Configurable wander parameters

**`goto.ts`** - Targeted Movement Behavior
- Direct movement to specific coordinates
- Path planning and execution
- Target reaching detection

### Authentication (`src/script/auth/`)

**`discord-oauth.ts`** - Discord OAuth Integration
- Discord OAuth flow implementation
- User authentication and token management
- User profile data retrieval
- Session management and persistence

### Common Utilities (`src/script/common/`)

**`util.ts`** - General Utility Functions
- Common helper functions used across the codebase
- Data manipulation and validation utilities
- Cross-cutting utility methods

**`geometry.ts`** - Geometric Calculations
- Vector math and geometric operations
- Distance calculations and collision detection helpers
- Coordinate system transformations

**`colorutil.ts`** - Color Manipulation
- Color format conversions (RGB, HSL, hex)
- Color blending and interpolation
- Color palette management

**`bettercanvas.ts`** - Enhanced Canvas API
- Extended canvas functionality wrapper
- Optimized drawing operations
- Canvas state management utilities

**`textbox.ts`** - Text Rendering Utilities
- Text layout and rendering functions
- Font management and text measurement
- Multi-line text handling

**`textblotter.ts`** - Text Effects and Rendering
- Advanced text effects and styling
- Text animation and transitions
- Specialized text rendering techniques

### Game Engine (`src/script/engine/`)

**`game.ts`** - Core Game Class
- Main game loop and state management
- Game initialization and cleanup
- Event coordination between systems
- Frame rate management and timing

**`canvas.ts`** - Canvas Management
- Canvas element creation and configuration
- Scaling, positioning, and viewport management
- Input event handling and coordinate mapping
- Render target management

**`renderer.ts`** - Rendering Coordinator
- Coordinates drawing operations across multiple systems
- Render order and layer management
- Performance optimization and culling
- Frame buffer and render state management

**`entity.ts`** - Base Entity Class
- Foundation class for all game objects
- Common entity properties and methods
- Entity lifecycle management
- Component system foundation

**`input.ts`** - Input Handling System
- Keyboard and mouse input processing
- Input event normalization and routing
- Input state tracking and querying
- Hotkey and gesture recognition

**`preloader.ts`** - Asset Preloading System
- Asset loading and caching management
- Loading progress tracking and reporting
- Asset dependency resolution
- Error handling for failed loads

**`worldobject.ts`** - Base World Object Class
- Foundation for objects that exist in the world space
- Spatial positioning and boundaries
- World-space interaction handling

**`tester.ts`** - Testing Utilities
- Development and testing helper functions
- Debug visualization and inspection tools
- Performance profiling utilities

### World/Environment (`src/script/environment/`)

**`world.ts`** - World Class
- World generation and tile management
- Spatial partitioning and world bounds
- Tile coordinate system and grid management
- World serialization and persistence

**Tile System:**

**`tile.ts`** - Base Tile Class
- Foundation class for all tile types
- Common tile properties and rendering
- Collision detection and physics properties

**`block.ts`** - Block Tile Type
- Solid block tile implementation
- Full collision and occlusion
- Standard world building component

**`halfblock.ts`** - Half-Block Tile Type
- Partial height tile implementation
- Modified collision properties
- Terrain variation support

**`slab.ts`** - Slab Tile Type
- Thin/flat tile implementation
- Platform and surface functionality

**`sheet.ts`** - Tile Sprite Sheet Management
- Tile texture atlas management
- Tile rendering and animation
- Texture coordinate mapping

**`sheet2.ts`** - Alternative Tile Sheet Implementation
- Secondary tile sheet system
- Extended tile graphics support

### Props/Decorations (`src/script/props/`)

**`decorator.ts`** - Decorator Class
- World decoration management system
- Prop placement and removal
- Decoration rule engine and generation
- Visual enhancement coordination

**`beacon.ts`** - Beacon Prop Implementation
- Beacon/landmark prop functionality
- Navigation aid implementation
- Visual and functional beacon behavior

**`seed.ts`** - Seed-Based Generation
- Procedural generation utilities
- Deterministic random number generation
- Seed-based world and prop generation

**`sheet.ts`** - Props Sprite Sheet Management
- Prop texture and sprite management
- Decoration rendering coordination

### UI System (`src/script/ui/`)

**`ui.ts`** - Main UI Class
- UI system coordination and management
- UI layout and positioning
- UI event handling and routing
- UI state management across components

**UI Components:**

**`uielement.ts`** - Base UI Element Class
- Foundation for all UI components
- Common UI properties and behavior
- Event handling and state management

**`panel.ts`** - Panel UI Component
- Container UI element implementation
- Layout management for child elements
- Panel styling and theming

**`button.ts`** - Button UI Component
- Interactive button implementation
- Click handling and visual feedback
- Button state management

**`label.ts`** - Label UI Component
- Text display component
- Dynamic text updates and formatting
- Text styling and positioning

**`input.ts`** - Input Field UI Component
- Text input and form field implementation
- Input validation and formatting
- Keyboard input handling and text editing

## Key Architectural Patterns

### Event-Driven Architecture

**EventEmitter Pattern:**
```typescript
// Classes extend EventEmitter for communication
class Game extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0); // Prevent memory leak warnings
  }
}

// Event usage
game.on('render', callback);
game.emit('gameStateChanged', data);
game.removeAllListeners(); // Cleanup
```

**Common Events:**
- `render` - Frame rendering cycle
- `update` - Game state updates
- `actor-added`, `actor-removed` - Actor lifecycle
- `world-generated` - World creation complete
- `user-joined`, `user-left` - User connection events

### Initialization Pattern

**Startup Sequence:**
1. `main.ts` calls `startApp()`
2. `startApp()` creates `Preloader` instance
3. `Preloader` loads assets, calls `initGame(images)`
4. `initGame()` creates core instances: `Game`, `Renderer`, `Canvas`, `UI`
5. `initWebsocket()` establishes WebSocket connection
6. Server join triggers `World`, `Decorator`, `Users` initialization

**Initialization Dependencies:**
```typescript
// Core initialization order
const preloader = new Preloader();
await preloader.load();

const game = new Game();
const renderer = new Renderer(game);
const canvas = new Canvas(game);
const ui = new UI(game);

await initWebsocket();
```

### Logging Integration

**Structured Logging Usage:**
```typescript
import { gameLogger } from '../gameLogger.js';

// Log important events for E2E testing
gameLogger.gameInitialized();
gameLogger.actorSpawned({ uid, username, x, y, facing });
gameLogger.actorMoved({ uid, username, fromX, fromY, toX, toY, movementType, facing });
gameLogger.worldGenerated({ width, height, tileCount, generationTime });
```

**Available Logging Methods:**
- Game: `gameInitialized()`, `gameError()`
- World: `worldGenerated()`, `worldError()`
- Actor: `actorSpawned()`, `actorMoved()`, `actorRemoved()`
- WebSocket: `websocketConnected()`, `websocketMessage()`
- UI: `uiElementCreated()`, `uiInteraction()`

### WebSocket Communication

**Connection Management:**
```typescript
// Multiple fallback strategies in initWebsocket()
const wsUrl = new URLSearchParams(window.location.search).get('ws') ||
              `ws://${window.location.hostname}:3000` ||
              'wss://hermes-fallback.com';

const ws = new WebSocket(wsUrl);
```

**Message Types:**
- `server-list` - Available servers
- `server-join` - Join specific server
- `presence` - User presence updates
- `message` - Chat messages
- `error` - Error notifications
- `update-clientid` - Client ID assignment

**User Data Normalization:**
```typescript
function normalizeUserData(userData) {
  return {
    uid: userData.uid || userData.id,
    username: userData.username || userData.name || 'Anonymous',
    // ... other normalizations
  };
}
```

### Canvas Rendering

**Rendering Pipeline:**
```typescript
// Game renders to <canvas id="main">
const canvas = document.getElementById('main');
const renderer = new Renderer(canvas);

// Entities implement draw() method
class Actor {
  draw(ctx, camera) {
    // Rendering implementation
  }
}

// Renderer coordinates drawing
renderer.render();
```

**Multi-Canvas System:**
- Main game canvas for world and actors
- UI canvas for interface elements
- Overlay canvas for effects and debugging

### State Management

**Game State Structure:**
```typescript
// Game state in Game instance
class Game {
  constructor() {
    this.state = 'loading'; // loading, running, paused
    this.frame = 0;
    this.deltaTime = 0;
  }
}

// World state in World instance
class World {
  constructor() {
    this.tiles = new Map(); // Spatial tile storage
    this.bounds = { x: 0, y: 0, width: 100, height: 100 };
  }
}

// Actor state in Users.actors
class Users {
  constructor() {
    this.actors = {}; // Keyed by uid
  }
}
```

## TypeScript Conventions

### Import/Export Patterns
```typescript
// Use .js extension for ES modules
import { Actor } from './actor.js';
import { gameLogger } from '../gameLogger.js';

// Export classes and functions
export class Game extends EventEmitter { }
export function initGame() { }
```

### Type Definitions
```typescript
// Use explicit types for parameters and return values
function createActor(uid: string, username: string): Actor {
  return new Actor(uid, username);
}

// Use interfaces for complex data structures
interface ActorData {
  uid: string;
  username: string;
  x: number;
  y: number;
  facing: 'left' | 'right';
}

// Avoid excessive 'any' usage
const userData: ActorData = normalizeUserData(rawData);
```

## Common Implementation Patterns

### Null Safety
```typescript
// Check for null/undefined before accessing properties
if (actor && actor.position) {
  const { x, y } = actor.position;
}

// Use optional chaining
const username = userData?.profile?.username || 'Anonymous';
```

### Async Operations
```typescript
// Use async/await for asynchronous operations
async function loadAssets() {
  try {
    const images = await preloader.load();
    return images;
  } catch (error) {
    gameLogger.gameError({ error: error.message });
    throw error;
  }
}
```

### Memory Management
```typescript
// Clean up event listeners
class Game extends EventEmitter {
  destroy() {
    this.removeAllListeners();
    // Clean up other resources
  }
}

// Use setMaxListeners to prevent warnings
this.setMaxListeners(0);
```

### Dependency Injection
```typescript
// Pass dependencies for better testability
class Renderer {
  constructor(game: Game, canvas: Canvas) {
    this.game = game;
    this.canvas = canvas;
  }
}
```

## Testing Considerations

### Testable Event Emission
```typescript
// Emit events for state changes to enable testing
class Users extends EventEmitter {
  addActor(actor: Actor) {
    this.actors[actor.uid] = actor;
    this.emit('actor-added', actor);
    gameLogger.actorSpawned(actor.getLogData());
  }
}
```

### Separation of Concerns
```typescript
// Keep business logic separate from rendering
class Actor {
  updatePosition(x: number, y: number) {
    // Business logic
    this.x = x;
    this.y = y;
    this.emit('position-changed');
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Rendering only
    ctx.drawImage(this.sprite, this.x, this.y);
  }
}
```

### Mock-Friendly Design
```typescript
// Use dependency injection for easier mocking
class WebSocketManager {
  constructor(private websocketFactory: () => WebSocket) {}

  connect(url: string) {
    this.ws = this.websocketFactory();
    // Connection logic
  }
}
```

## Performance Considerations

### Rendering Optimization
```typescript
// Use culling for off-screen entities
if (actor.isInViewport(camera)) {
  actor.draw(ctx, camera);
}

// Batch similar drawing operations
renderer.drawSprites(actorSprites);
```

### Memory Efficiency
```typescript
// Object pooling for frequently created/destroyed objects
class ActorPool {
  private pool: Actor[] = [];

  acquire(): Actor {
    return this.pool.pop() || new Actor();
  }

  release(actor: Actor) {
    actor.reset();
    this.pool.push(actor);
  }
}
```

### Event Management
```typescript
// Remove specific listeners instead of all
game.removeListener('render', this.onRender);

// Use once() for one-time events
game.once('initialized', this.onGameReady);
```