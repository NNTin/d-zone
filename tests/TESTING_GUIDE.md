# D-Zone Testing Guide

This comprehensive guide explains the testing structure, workflows, and best practices for the d-zone project.

## 📖 Table of Contents

- [Quick Start](#-quick-start)
- [Testing Philosophy](#-testing-philosophy)
- [Directory Structure](#-directory-structure)
- [Tag System](#-tag-system)
- [Test Types](#-test-types)
- [Running Tests](#-running-tests)
- [VS Code Integration](#-vs-code-integration)
- [Mocking Strategy](#-mocking-strategy)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Writing Tests](#-writing-tests)
- [Debugging Tests](#-debugging-tests)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm run test

# Run only unit tests
npm run test:unit

# Run E2E tests with browser UI
npm run test:e2e:headed

# Debug E2E tests step-by-step
npm run test:e2e:debug
```

## 🎯 Testing Philosophy

Our testing strategy is built around **comprehensive coverage** with **smart execution**:

- **🏷️ Tag-driven filtering**: Control which tests run in different environments
- **⚡ Parallel execution**: Tests run fast through parallelization
- **🎭 Real browser testing**: E2E tests use actual Chromium browser
- **🧩 Isolated unit testing**: Pure logic testing with mocks
- **📊 Rich reporting**: Detailed insights into test results
- **🔄 CI/CD integration**: Automated testing on every push

### Core Principles

1. **Fast Feedback**: Unit tests provide immediate feedback
2. **Real User Scenarios**: E2E tests simulate actual user workflows
3. **Test Classification**: Tags organize tests by purpose and execution time
4. **Environment Awareness**: Different test sets for local vs CI
5. **Maintainable Structure**: Clear organization and reusable components

## 📁 Directory Structure

```
tests/
├── fixtures/                   # Test data and mock objects
│   └── mockData.ts             # Centralized test data definitions
│
├── mocks/                      # Mock implementations
│   ├── apiHandlers.ts          # MSW API mocks for E2E tests
│   └── browserMocks.ts         # Vitest browser API mocks
│
├── utils/                      # Test utilities and helpers
│   ├── testHelpers.ts          # Custom assertions and builders
│   ├── categories.json         # Allure report categorization
│   └── environment.properties  # Test environment metadata
│
├── setup.ts                    # Global test setup configuration
├── *.test.ts                   # Unit tests (Vitest)
├── *.e2e.ts                    # End-to-End tests (Playwright)
├── TESTING_GUIDE.md           # This comprehensive guide
└── README.md                   # Quick reference documentation
```

### File Naming Conventions

- **Unit Tests**: `*.test.ts` - Test individual functions/classes
- **E2E Tests**: `*.e2e.ts` - Test complete user workflows
- **Mocks**: `*Mocks.ts` - Mock implementations
- **Fixtures**: `mock*.ts` - Test data definitions
- **Helpers**: `*Helpers.ts` - Reusable test utilities

## 🏷️ Tag System

Tests are classified using descriptive tags that control execution:

### Tag Definitions

| Tag | Purpose | Local | CI | Description |
|-----|---------|-------|----|----|
| `@critical` | ✅ | ✅ | External failures, system outages |
| `@normal` | ✅ | ✅ | Standard functionality tests |
| `@long` | ❌ | ✅ | Performance, load, time-intensive tests |
| `@active` | ✅ | ✅ | Actively maintained, expected to pass |
| `@inactive` | ❌ | ❌ | Work in progress, unstable tests |

### Tag Usage Examples

```typescript
// Unit test with multiple tags
describe('@normal Actor Class', () => {
  it('@critical @active should handle invalid coordinates gracefully', () => {
    // Test implementation
  });
});

// E2E test with classification
test('@critical @active should show only one nametag when hovering multiple actors', async ({ page }) => {
  // Test the specific nametag bug
});

// Todo test for future implementation  
test.todo('@long should handle 100+ concurrent actors without performance degradation');
```

### Development Workflow Integration

The tag system supports your development workflow:

1. **Feature Development**: Start with `@inactive` for new tests
2. **Ready for Testing**: Change to `@active` when stable
3. **Performance Testing**: Use `@long` for CI-only execution
4. **Critical Path**: Mark essential tests with `@critical`

## 🧪 Test Types

### Unit Tests (Vitest)

**Purpose**: Test individual functions, classes, and modules in isolation

**Framework**: Vitest with jsdom environment  
**File Pattern**: `*.test.ts`  
**Execution**: Fast, parallel, mocked dependencies

**Example Structure**:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('@normal Actor Movement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('@active should update facing direction based on movement', () => {
    // Test logic here
  });
});
```

**Best For**:
- Business logic validation
- Error handling scenarios  
- Edge case testing
- Performance-critical algorithms

### E2E Tests (Playwright)

**Purpose**: Test complete user workflows and integrations

**Framework**: Playwright with Chromium browser  
**File Pattern**: `*.e2e.ts`  
**Execution**: Slower, real browser, auto dev server

**Example Structure**:
```typescript
import { test, expect } from '@playwright/test';
import { GameTestAssertions } from '../utils/testHelpers.js';

test.describe('@critical Actor Nametag System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await GameTestAssertions.waitForGameLoad(page);
  });

  test('@critical @active should show only one nametag at a time', async ({ page }) => {
    // User workflow testing
  });
});
```

**Best For**:
- User interaction flows
- Cross-component integration
- Browser compatibility
- Visual regression testing

## 🚀 Running Tests

### Local Development

```bash
# Quick unit test run
npm run test:unit

# Watch mode for continuous testing
npm run test:unit:watch

# Interactive test UI
npm run test:unit:ui

# E2E with visible browser
npm run test:e2e:headed

# Step-by-step debugging
npm run test:e2e:debug

# All tests (unit + E2E)
npm run test
```

### CI Environment

```bash
# CI mode (includes @long tests)
npm run test:ci

# Generate test reports
npm run test:report
```

### Dev Server Integration

The **auto dev server** feature ensures E2E tests always run against the correct application version:

- **Automatically starts** `npm run dev` before E2E tests
- **Waits** for `http://127.0.0.1:3000` to be ready
- **Reuses** existing server locally (saves startup time)
- **Fresh server** in CI for isolation
- **Automatic cleanup** when tests complete

**Benefits**:
- ✅ No manual server management
- ✅ Tests always run against current code
- ✅ Consistent environment across team
- ✅ Faster local development (server reuse)

## 🎮 VS Code Integration

### Available Tasks

Access via `Ctrl+Shift+P` → `Tasks: Run Task`:

| Task | Purpose | Background |
|------|---------|------------|
| **Start Development Server** | Launch dev server with hot reload | ✅ |
| **Run Unit Tests** | Execute all unit tests | ❌ |
| **Watch Unit Tests** | Auto-rerun tests on file changes | ✅ |
| **Debug E2E Tests** | Step-through debugging with inspector | ❌ |
| **Run All Tests** | Unit tests followed by E2E tests | ❌ |
| **Generate Test Report** | Create and open Allure reports | ❌ |

### Workspace Settings

Optimized VS Code settings for testing:
- Test result directories excluded from search
- Auto-organize imports on save
- TypeScript autocompletion for test files
- Testing panel configuration

### Keyboard Shortcuts

Consider adding these to your VS Code keybindings:

```json
{
  "key": "ctrl+shift+t",
  "command": "workbench.action.tasks.runTask",
  "args": "Run Unit Tests"
},
{
  "key": "ctrl+shift+e", 
  "command": "workbench.action.tasks.runTask",
  "args": "Debug E2E Tests"
}
```

## 🎭 Mocking Strategy

### Unit Test Mocking (Vitest)

**Location**: `tests/mocks/browserMocks.ts`

**Provides**:
- Canvas API simulation
- WebSocket mocking
- LocalStorage mocking  
- DOM element mocking
- Global browser API setup

**Usage**:
```typescript
import { setupGlobalMocks } from '../mocks/browserMocks.js';

// In test setup
setupGlobalMocks();
```

### E2E Test Mocking (MSW)

**Location**: `tests/mocks/apiHandlers.ts`

**Provides**:
- HTTP API endpoint mocking
- Discord OAuth simulation
- Game state API responses
- Error scenario simulation

**Usage**:
```typescript
// In E2E tests
await page.route('/api/**', route => route.fulfill({
  status: 503,
  body: JSON.stringify({ error: 'Service unavailable' })
}));
```

### Test Data Management

**Location**: `tests/fixtures/mockData.ts`

**Centralized data** for consistent testing:
```typescript
export const mockActor = {
  uid: 'actor-456',
  username: 'testactor',
  x: 5, y: 5, z: 0,
  roleColor: '#33FF57',
  presence: 'online' as const
};
```

**Benefits**:
- ✅ Consistent test data across all tests
- ✅ Easy to modify shared test scenarios
- ✅ Type-safe mock objects
- ✅ Reduced test maintenance

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

**Matrix Strategy**: Parallel execution across multiple shards

```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
```

### Job Flow

1. **Unit Tests** - Fast feedback on logic changes
2. **E2E Tests** - Parallel execution across matrix shards  
3. **Report Merging** - Combine results from all parallel jobs
4. **Report Deployment** - Publish to GitHub Pages

### Artifact Collection

- Unit test results and coverage
- E2E test results and screenshots
- Merged Allure reports
- Performance metrics

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `CI=true` | Enables CI-specific test behavior |
| `NODE_VERSION=20` | Node.js version consistency |
| `ALLURE_RESULTS_PATH` | Test result directory |

## ✍️ Writing Tests

### Unit Test Template

```typescript
/**
 * @file Unit tests for [Component Name]
 * @tags @normal @active
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('@normal [Component Name]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('@active [Feature Group]', () => {
    it('@normal should [expected behavior]', () => {
      // Arrange
      const input = 'test data';
      
      // Act  
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe('expected output');
    });

    it('@critical should handle [error case] gracefully', () => {
      // Error scenario testing
    });

    it.todo('@long should optimize [performance scenario]');
  });
});
```

### E2E Test Template

```typescript
/**
 * @file E2E tests for [Feature Name]
 * @tags @critical @normal @active
 */

import { test, expect } from '@playwright/test';
import { GameTestAssertions } from '../utils/testHelpers.js';

test.describe('@critical [Feature Name]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await GameTestAssertions.waitForGameLoad(page);
  });

  test('@critical @active should [user workflow]', async ({ page }) => {
    // 1. Setup initial state
    // 2. Perform user actions
    // 3. Verify expected outcomes
    
    await expect(page.locator('[data-testid="component"]')).toBeVisible();
  });

  test.todo('@long should handle [complex scenario]');
});
```

### Custom Assertions

Use domain-specific assertions from `testHelpers.ts`:

```typescript
// Game-specific assertions
await GameTestAssertions.assertActorVisible(page, 'testuser');
await GameTestAssertions.assertNametagVisible(page, 'testuser');
await GameTestAssertions.waitForGameLoad(page);

// Test data builders
const actor = TestDataBuilder.createActor({ username: 'custom' });
const message = TestDataBuilder.createMessage({ content: 'Hello!' });
```

## 🐛 Debugging Tests

### Unit Test Debugging

```bash
# Run specific test file
npm run test:unit -- actor.test.ts

# Verbose output
npm run test:unit -- --reporter=verbose

# Interactive UI debugging
npm run test:unit:ui
```

### E2E Test Debugging

```bash
# Debug mode with inspector
npm run test:e2e:debug

# Run specific test
npm run test:e2e -- --grep "nametag"

# Headed mode (visible browser)
npm run test:e2e:headed

# Generate trace files
npm run test:e2e -- --trace on
```

### VS Code Debugging

1. Set breakpoints in test files
2. Run task: `Debug E2E Tests`
3. Use Playwright Inspector for step-by-step execution
4. Examine page state and DOM

### Common Debug Techniques

- **Screenshots**: `await page.screenshot({ path: 'debug.png' })`
- **Page content**: `console.log(await page.content())`
- **Element inspection**: `await page.locator('selector').highlight()`
- **Network logs**: Check browser dev tools in headed mode

## 📋 Best Practices

### Test Organization

1. **Group related tests** with `describe` blocks
2. **Use descriptive test names** that explain expected behavior
3. **Apply appropriate tags** for execution control
4. **Keep tests focused** on single responsibilities
5. **Use setup/teardown** for test isolation

### Test Data Management

1. **Use fixtures** for consistent test data
2. **Create builders** for complex object creation
3. **Avoid hardcoded values** in test assertions
4. **Mock external dependencies** appropriately
5. **Keep test data minimal** and focused

### Performance Considerations

1. **Run tests in parallel** when possible
2. **Use appropriate tags** to exclude slow tests locally
3. **Mock heavy operations** in unit tests
4. **Reuse browser contexts** in E2E tests
5. **Clean up resources** in test teardown

### Code Quality

1. **Follow TypeScript best practices**
2. **Use meaningful variable names**
3. **Comment complex test scenarios**
4. **Keep test files focused** on single components
5. **Refactor common patterns** into utilities

## 🔧 Troubleshooting

### Common Issues

#### Unit Tests

**Import errors**:
```bash
Error: Failed to resolve import "../mocks/browserMocks.js"
```
*Solution*: Check file paths and ensure `.js` extensions in imports

**Mock not working**:
```typescript
// Ensure mocks are cleared between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

#### E2E Tests

**Timeout errors**:
```bash
Error: Timeout 30000ms exceeded
```
*Solutions*:
- Increase timeout in playwright.config.ts
- Check if dev server is starting properly
- Verify test selectors are correct

**Dev server not starting**:
- Check if port 3000 is available
- Verify `npm run dev` works manually
- Check webServer configuration in playwright.config.ts

#### General

**Tag filtering not working**:
- Verify tag syntax in test names
- Check testNamePattern in vitest.config.ts
- Ensure tags are spelled correctly

**Dependencies issues**:
```bash
npm audit fix
npm install
```

### Getting Help

1. **Check test output** for specific error messages
2. **Review configuration files** for typos or incorrect paths
3. **Run tests individually** to isolate issues
4. **Use debug mode** for step-by-step execution
5. **Consult framework documentation** for advanced scenarios

### Performance Optimization

If tests are running slowly:

1. **Profile test execution** to identify bottlenecks
2. **Use appropriate tags** to exclude expensive tests
3. **Optimize test setup/teardown**
4. **Consider test parallelization** adjustments
5. **Mock expensive operations** in unit tests

---

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Allure Reporting](https://docs.qameta.io/allure/)

---

**Happy Testing! 🎉**

This testing structure provides a solid foundation for maintaining high code quality and confidence in your d-zone project. The tag-based system ensures you have full control over test execution, while the comprehensive tooling supports both local development and CI/CD workflows.