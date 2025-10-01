# Testing Structure Documentation

> 📖 **For comprehensive documentation, see [TESTING_GUIDE.md](./TESTING_GUIDE.md)**

This document provides a quick reference for the d-zone testing structure.

## 🚀 Quick Start

```bash
# Run all tests
npm run test

# Unit tests only
npm run test:unit

# E2E with browser UI
npm run test:e2e:headed

# Debug E2E step-by-step
npm run test:e2e:debug
```

## 📁 Directory Structure

```
tests/
├── fixtures/mockData.ts      # Centralized test data
├── mocks/
│   ├── apiHandlers.ts        # MSW API mocks for E2E
│   └── browserMocks.ts       # Vitest mocks for units
├── utils/testHelpers.ts      # Custom assertions & builders
├── *.test.ts                 # Unit tests (Vitest)
├── *.e2e.ts                  # E2E tests (Playwright)
├── TESTING_GUIDE.md          # 📖 Comprehensive guide
└── README.md                 # This quick reference
```

## 🏷️ Test Tags

Control test execution with tags:

- `@critical` - External failures (backend outages)
- `@normal` - Regular fast tests
- `@long` - CI-only tests (performance, load)
- `@inactive` - Work in progress, excluded
- `@active` - Expected to pass

### Examples

```typescript
// Unit test
it('@normal @active should create actor with valid coordinates', () => {
  // test implementation
});

// E2E test  
test('@critical @active should handle backend unavailability', async ({ page }) => {
  // test implementation
});

// Todo test
test.todo('@long should handle 100+ concurrent actors');
```

## 🎮 VS Code Tasks

Access via `Ctrl+Shift+P` → `Tasks: Run Task`:

- **Start Development Server** - Background dev server
- **Run Unit Tests** - Quick unit test execution
- **Debug E2E Tests** - Step-through debugging
- **Watch Unit Tests** - Auto-rerun on changes

## 🧪 Test Types

### Unit Tests (Vitest)
- **Pattern**: `*.test.ts`
- **Purpose**: Test individual functions/classes
- **Environment**: jsdom with mocks
- **Speed**: Fast, parallel execution

### E2E Tests (Playwright)
- **Pattern**: `*.e2e.ts`
- **Purpose**: Test complete user workflows
- **Environment**: Real Chromium browser
- **Features**: Auto dev server, screenshots, traces

## 🎯 Key Features

- **🏷️ Smart Tag Filtering**: Different test sets for local vs CI
- **🔄 Auto Dev Server**: E2E tests start your app automatically
- **⚡ Parallel Execution**: Tests run fast through parallelization
- **🎭 Rich Mocking**: MSW for APIs, Vitest for browser APIs
- **📊 Comprehensive Reporting**: JSON output ready for Allure
- **🎮 VS Code Integration**: Tasks and workspace optimization

## � Writing Tests

### Unit Test Template
```typescript
describe('@normal ComponentName', () => {
  it('@active should do something', () => {
    expect(true).toBe(true);
  });
});
```

### E2E Test Template
```typescript
test('@critical @active should do workflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="element"]')).toBeVisible();
});
```

## 🐛 Debugging

```bash
# Unit tests with UI
npm run test:unit:ui

# E2E with visible browser
npm run test:e2e:headed

# E2E step-by-step debugging
npm run test:e2e:debug
```

## � Configuration Files

- `playwright.config.ts` - E2E test configuration
- `vitest.config.ts` - Unit test configuration  
- `.vscode/tasks.json` - VS Code task definitions
- `.github/workflows/ci.yml` - CI/CD pipeline

---

📖 **For detailed explanations, troubleshooting, best practices, and advanced topics, see [TESTING_GUIDE.md](./TESTING_GUIDE.md)**