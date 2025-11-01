# Unit Testing Instructions

## Configuration Reference

**Test Runner Configuration:** `vitest.config.ts`

**Test Location:** All unit tests are located in `tests/unit/` directory

**Test File Pattern:** `tests/unit/**/*.{test,spec}.{js,ts}`

## Tag System (Critical for Test Execution)

The tag system controls which tests run in different environments. Tags are placed in test descriptions and names.

### Available Tags

- **@critical**: Tests that verify external failures or system outages - run locally and in CI
- **@normal**: Standard functionality tests - run locally and in CI
- **@long**: Performance/load tests - only run in CI (excluded locally)
- **@active**: Actively maintained tests expected to pass - run locally and in CI
- **@inactive**: Work-in-progress or unstable tests - excluded everywhere

### Tag Configuration in vitest.config.ts

**Local Development:**
- `testNamePattern: '(@critical|@normal|@active)(?!.*@inactive|.*@long)'`
- Excludes `@long` and `@inactive` tests

**Continuous Integration:**
- `testNamePattern: '(@critical|@normal|@long|@active)(?!.*@inactive)'`
- Includes `@long` tests, excludes `@inactive` tests

Tags are matched in test names using regex patterns.

## Test Structure Guidelines

### Using Tags in Test Code

**Test Suites:** Use `describe()` with tags in the description string:
```typescript
describe('@normal Actor Movement', () => {
  // test suite content
});
```

**Individual Tests:** Use `it()` with tags in the test name:
```typescript
it('@active should update facing direction', () => {
  // test implementation
});
```

### Required Imports

**Core Vitest Functions:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
```

**Test Utilities:**
```typescript
import { MockLocalStorage } from './utils/testHelpers.js';
import { setupGlobalMocks } from './mocks/browserMocks.js';
```

## Environment Configuration

**Test Environment:** `jsdom` (configured in vitest.config.ts)

**Global Setup File:** `tests/setup.ts`

**Globals Enabled:** Test functions (`describe`, `it`, `expect`) are available without imports

**Import Convention:** The project uses ESM-style imports with `.js` extensions in TypeScript files

**Coverage Configuration:**
- Provider: v8
- Reporters: text, json, html
- Excludes: node_modules, tests, dist, type definitions, config files

## Test Structure Pattern

Follow the **Arrange-Act-Assert** pattern for consistent test structure:

```typescript
describe('@normal Feature Name', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // ALWAYS clear mocks
  });

  it('@active should perform expected behavior', () => {
    // Arrange - Set up test data and mocks
    const mockData = { /* test data */ };
    const mockFunction = vi.fn();
    
    // Act - Execute the code under test
    const result = functionUnderTest(mockData);
    
    // Assert - Verify the results
    expect(result).toBe(expectedValue);
    expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
  });
});
```

## Mocking Strategy

### Browser API Mocks

**Available Mocks:** `tests/unit/mocks/browserMocks.js`

**Global Mock Setup:**
```typescript
import { setupGlobalMocks } from './mocks/browserMocks.js';

beforeEach(() => {
  vi.clearAllMocks();
  setupGlobalMocks();
});
```

**Specific Mock Usage:**
```typescript
import { MockLocalStorage } from './utils/testHelpers.js';

it('@active should handle localStorage', () => {
  const mockLocalStorage = new MockLocalStorage();
  vi.stubGlobal('localStorage', mockLocalStorage);
  
  // Test localStorage interactions
});
```

### Mock Cleanup

**Always clear mocks in beforeEach:**
```typescript
beforeEach(() => {
  vi.clearAllMocks(); // Prevents test contamination
});
```

**Global Object Mocking:**
```typescript
vi.stubGlobal('localStorage', mockLocalStorage);
vi.stubGlobal('location', { href: 'http://localhost' });
```

## Common Testing Patterns from Existing Tests

Reference `tests/unit/discord-oauth.test.ts` for complete examples:

### Mock Setup Pattern
```typescript
describe('@normal Discord OAuth', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage = new MockLocalStorage();
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  it('@active should handle authentication flow', () => {
    // Test implementation
  });
});
```

### Testing Success and Error Cases
```typescript
it('@active should handle successful response', () => {
  // Test success scenario
});

it('@active should handle error response', () => {
  // Test error scenario
});
```

### Async Testing
```typescript
it('@active should handle async operations', async () => {
  const mockPromise = Promise.resolve(mockData);
  
  const result = await functionUnderTest();
  
  expect(result).toBe(expectedValue);
});
```

## Test File Organization

### File Naming Convention
- Use descriptive names ending with `.test.ts` or `.spec.ts`
- Examples: `actor.test.ts`, `websocket-utils.test.ts`, `discord-oauth.test.ts`

### File Location
- Place all unit test files in `tests/unit/`
- Mirror source file structure when possible

### Directory Structure Example
```
tests/unit/
├── actors/
│   ├── actor.test.ts
│   └── users.test.ts
├── auth/
│   └── discord-oauth.test.ts
├── common/
│   ├── util.test.ts
│   └── geometry.test.ts
├── mocks/
│   └── browserMocks.js
└── utils/
    └── testHelpers.js
```

## Test Utilities and Helpers

### MockLocalStorage Class
```typescript
import { MockLocalStorage } from './utils/testHelpers.ts';

const mockStorage = new MockLocalStorage();
mockStorage.setItem('key', 'value');
expect(mockStorage.getItem('key')).toBe('value');
```

### Browser Mocks
```typescript
import { setupGlobalMocks } from './mocks/browserMocks.ts';

// Sets up common browser API mocks
setupGlobalMocks();
```

### Custom Test Helpers
Create reusable test utilities in `tests/unit/utils/testHelpers.js` for common testing patterns.

## Running Tests

### Local Development
**Standard execution:**
```bash
npm run test:unit
```

**Watch mode (continuous testing):**
```bash
npm run test:unit:watch
```

**Interactive UI mode:**
```bash
npm run test:unit:ui
```

### Continuous Integration
Tests run automatically with appropriate tag filtering based on the CI configuration in `vitest.config.ts`.

## Testing Best Practices

### Test Independence
- **Each test should be independent** and able to run in any order
- **Clear mocks between tests** to prevent contamination
- **Avoid shared state** between test cases

### Test Focus
- **Test individual functions/classes in isolation**
- **Mock external dependencies** to focus on unit being tested
- **Keep tests fast and focused** on specific behaviors

### Meaningful Assertions
- **Use descriptive error messages** in assertions
- **Test both positive and negative cases**
- **Verify expected behavior, not implementation details**

### Edge Case Testing
- **Test null, undefined, empty arrays/objects**
- **Test boundary conditions** (min/max values)
- **Test error conditions** and exception handling

### Test Organization
```typescript
describe('@normal Class/Function Name', () => {
  describe('method name', () => {
    it('@active should handle normal case', () => {
      // Test normal operation
    });

    it('@active should handle edge case', () => {
      // Test edge case
    });

    it('@active should handle error case', () => {
      // Test error condition
    });
  });
});
```

## Integration with Source Code

### Testing Game Classes
- **Mock EventEmitter behavior** for game classes that extend it
- **Test event emission and handling** separately from business logic
- **Mock canvas and rendering dependencies** for UI components

### Testing Async Operations
```typescript
it('@active should handle async operations', async () => {
  const mockPromise = vi.fn().mockResolvedValue(expectedResult);
  
  const result = await functionUnderTest();
  
  expect(result).toBe(expectedResult);
  expect(mockPromise).toHaveBeenCalled();
});
```

### Testing Error Handling
```typescript
it('@active should handle errors gracefully', () => {
  const mockFunction = vi.fn().mockRejectedValue(new Error('Test error'));
  
  expect(() => functionUnderTest()).toThrow('Test error');
});
```

## Documentation References

- **General Testing Guide:** `tests/TESTING_GUIDE.md`
- **Vitest Configuration:** `vitest.config.ts`
- **Example Implementation:** `tests/unit/discord-oauth.test.ts`
- **Global Setup:** `tests/setup.ts`

## Common Pitfalls to Avoid

1. **Forgetting to clear mocks** between tests
2. **Testing implementation details** instead of behavior
3. **Creating dependent tests** that fail when run in isolation
4. **Not testing error cases** and edge conditions
5. **Using real dependencies** instead of mocks
6. **Making tests too complex** or testing multiple things at once
7. **Forgetting to use appropriate tags** for test execution control
8. **Not following the Arrange-Act-Assert pattern**
9. **Leaving console.log statements** in test code
10. **Not using descriptive test names** that explain expected behavior