# E2E Testing Instructions

## Configuration Reference

**Test Runner Configuration:** `playwright.config.ts`

**Test Location:** All E2E tests are located in `tests/e2e/` directory

**Test File Pattern:** `**/*.e2e.{ts,js}`

## Tag System (Critical for Test Execution)

The tag system controls which tests run in different environments. Tags are placed in test descriptions and names.

### Available Tags

- **@critical**: Tests that verify external failures or system outages - run locally and in CI
- **@normal**: Standard functionality tests - run locally and in CI  
- **@long**: Performance/load tests - only run in CI (excluded locally)
- **@active**: Actively maintained tests expected to pass - run locally and in CI
- **@inactive**: Work-in-progress or unstable tests - excluded everywhere
- **@dback**: Backend integration tests requiring external d-back server - only run locally with `PW_INCLUDE_DBACK=1`

### Tag Configuration in playwright.config.ts

**Chromium Project (Local Development):**
- `grep: /@critical|@normal|@active/`
- `grepInvert: /@inactive|@dback/`

**CI Project (Continuous Integration):**
- `grep: /@critical|@normal|@long|@active/`
- `grepInvert: /@inactive|@dback/`

**Dback Project (Backend Integration):**
- `grep: /@dback/`
- `grepInvert: /@inactive/`

## Test Structure Guidelines

### Using Tags in Test Code

**Test Suites:** Use `test.describe()` with tags in the description string:
```typescript
test.describe('@critical Actor Nametag System', () => {
  // test suite content
});
```

**Individual Tests:** Use `test()` with tags in the test name:
```typescript
test('@critical @active should show only one nametag', async ({ page }) => {
  // test implementation
});
```

### Required Imports

**Canvas Game Testing:**
```typescript
import { CanvasGameTestUtils } from './utils/canvasTestUtils.js';
```

**Spawn Validation:**
```typescript
import { extractSpawnAnalysisData, getActorSpawnLogs, getSpawnAnalysisLogs, getWorldGenerationData } from './utils/spawnValidationUtils.js';
```

**Game Assertions:**
```typescript
import { GameAssertions } from './utils/canvasTestUtils.js';
```

## Canvas Game Testing Approach

The project uses a **log-based testing methodology** for canvas game verification. This approach captures game events through structured logging and validates behavior through log analysis.

### Required Setup Pattern

**BeforeEach Hook:**
```typescript
test.beforeEach(async ({ page }) => {
  gameUtils = new CanvasGameTestUtils(page);
  await gameUtils.startLogCapture(); // ALWAYS start with this
});
```

**Page Navigation:**
```typescript
await page.goto('/?e2e-test=true'); // Enable E2E testing mode
```

**Initial Assertions:**
```typescript
await GameAssertions.assertCanvasVisible(page);
await GameAssertions.assertGameLoaded(gameUtils);
```

### Core Testing Methods

**Wait for Game Events:**
```typescript
await gameUtils.waitForGameEvent(category, event, timeout)
```

**Common Event Patterns:**
- Game initialization: `await gameUtils.waitForGameEvent('game', 'initialized', 15000)`
- World generation: `await gameUtils.waitForGameEvent('world', 'generated', 10000)`
- Actor events: `await gameUtils.waitForGameEvent('actor', 'spawned', 5000)`

**Access Game State:**
```typescript
const gameState = gameUtils.getGameState();
const logs = gameUtils.getLogsByCategory(category);
```

## Spawn Validation Utilities

For tests involving actor spawning and world generation, use helper functions from `spawnValidationUtils.js`:

**Extract World Data:**
```typescript
const worldData = getWorldGenerationData(gameUtils);
```

**Get Actor Spawn Information:**
```typescript
const spawnLogs = getActorSpawnLogs(gameUtils);
```

**Analyze Spawn Patterns:**
```typescript
const logs = getSpawnAnalysisLogs(gameUtils);
const analysisData = extractSpawnAnalysisData(logs);
```

**Canonical Example:** See `tests/e2e/world-generation.e2e.ts` for complete implementation patterns.

## Common Testing Patterns from Existing Tests

Reference `tests/e2e/world-generation.e2e.ts` for complete examples:

1. **Always start with log capture** in `beforeEach`
2. **Navigate to E2E test mode** with `/?e2e-test=true`
3. **Verify canvas visibility** before testing game functionality
4. **Wait for game initialization** before testing specific features
5. **Wait for world generation** for tests requiring a complete world
6. **Use helper functions** for complex validations like spawn analysis

## Test File Organization

### File Naming Convention
- Use descriptive names ending with `.e2e.ts`
- Examples: `actor-movement.e2e.ts`, `world-generation.e2e.ts`, `nametag-system.e2e.ts`

### File Location
- Place all E2E test files in `tests/e2e/`

### Test Structure
```typescript
import { test, expect } from '@playwright/test';
import { CanvasGameTestUtils } from './utils/canvasTestUtils.js';

test.describe('@critical Feature Name', () => {
  let gameUtils: CanvasGameTestUtils;

  test.beforeEach(async ({ page }) => {
    gameUtils = new CanvasGameTestUtils(page);
    await gameUtils.startLogCapture();
  });

  test('@critical @active should test critical functionality', async ({ page }) => {
    await page.goto('/?e2e-test=true');
    
    await GameAssertions.assertCanvasVisible(page);
    await GameAssertions.assertGameLoaded(gameUtils);
    
    await gameUtils.waitForGameEvent('game', 'initialized', 15000);
    
    // Test implementation
  });
});
```

## Mocking Strategy

**Mock Data Location:**
- Mock files: `tests/e2e/mocks/`
- Fixture data: `tests/e2e/fixtures/`

**Mock Injection:**
```typescript
import { getMockWebSocketScript, getMockWebSocketScriptWithActors, getMockWorldGenerationScript } from './mocks/index.js';

test.beforeEach(async ({ page }) => {
  // Mock setup must happen before page load
  await page.addInitScript(getMockWebSocketScript());
  await page.addInitScript(getMockWorldGenerationScript(), { 
    ...MOCK_WORLDS.SQUARE_24X24, 
    testDescription: 'Example test world' 
  });
});
```

**Canonical Mock Usage:** See `tests/e2e/world-generation.e2e.ts` for complete mock implementation patterns.

## Running Tests

### Local Development
**Standard execution:**
```bash
npm run test:e2e
```

**With visible browser:**
```bash
npm run test:e2e:headed
```

**Debug mode (step-by-step):**
```bash
npm run test:e2e:debug
```

### Backend Integration Tests
**With d-back server:**
```bash
PW_INCLUDE_DBACK=1 npm run test:e2e
```

### Continuous Integration
Tests run automatically with appropriate tag filtering based on the CI project configuration in `playwright.config.ts`.

## Testing Documentation References

- **General Testing Guide:** `tests/TESTING_GUIDE.md`
- **Canvas Testing Methodology:** `tests/CANVAS_TESTING_GUIDE.md`
- **Example Implementation:** `tests/e2e/world-generation.e2e.ts`
- **Actor Movement Patterns:** `tests/e2e/actor-movement-validation.e2e.ts`
- **Backend Integration (@dback):** `tests/e2e/dback-integration.e2e.ts`
- **Playwright Configuration:** `playwright.config.ts`

## Best Practices

1. **Always use the tag system** to control test execution
2. **Start every test with log capture** for debugging capabilities
3. **Use descriptive test names** that explain the expected behavior
4. **Wait for appropriate game events** rather than using fixed timeouts
5. **Follow existing patterns** from successful tests like `world-generation.e2e.ts`
6. **Use helper utilities** for complex validations
7. **Clean up properly** by following established teardown patterns
8. **Test both success and failure scenarios** where applicable
9. **Keep tests focused** on single functionality areas
10. **Reference mock utilities** for consistent test data