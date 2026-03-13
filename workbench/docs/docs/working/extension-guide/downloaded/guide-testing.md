---
title: "Extension Guide: Test Extension"
---

# VS Code Testing API Guide

> Source: https://code.visualstudio.com/api/extension-guides/testing

## Overview

The Testing API enables extensions to discover tests and publish results within VS Code. It supports test discovery, execution profiles, and coverage reporting through a native Test Explorer experience. Requires VS Code 1.59+.

## Core Components

### Test Controller & Discovery

```typescript
const controller = vscode.tests.createTestController('uniqueId', 'Display Label');
```

Tests are organized hierarchically through `TestItem` objects added to `controller.items`.

**Discovery strategies:**
- **Active discovery**: Parse files when opened via `onDidOpenTextDocument`
- **Lazy discovery**: Set `canResolveChildren = true` and implement `resolveHandler` for on-demand parsing

The `resolveHandler` is invoked when users expand items or first open Test Explorer.

### Associating Custom Data

Use `WeakMap` for metadata since `TestItem` has limited extensibility:

```typescript
const testData = new WeakMap<vscode.TestItem, CustomType>();
```

## Running Tests

### Run Profiles

```typescript
const runProfile = controller.createRunProfile(
  'Run',
  vscode.TestRunProfileKind.Run,
  (request, token) => {
    runTests(request, token);
  }
);
```

Profile kinds: `Run`, `Debug`, `Coverage`

### Test Execution

```typescript
async function runTests(request: vscode.TestRunRequest, token: vscode.CancellationToken) {
  const run = controller.createTestRun(request);

  for (const test of getTestsToRun(request)) {
    run.started(test);
    try {
      // Execute test
      run.passed(test);
    } catch (e) {
      run.failed(test, new vscode.TestMessage(e.message));
    }
  }

  run.end();
}
```

### Test Output & Configuration

- **Output**: Use `run.appendOutput(str)` with ANSI escape codes; use CRLF (`\r\n`) for line wrapping
- **Configuration**: Optionally set `configureHandler` on profiles for user customization

### Test Tags

Filter tests by tags:

```typescript
const tag = new TestTag('tagId');
runProfile.tag = tag;
test.tags = [...test.tags, tag];
```

## Test Coverage

```typescript
run.addCoverage(new vscode.FileCoverage(uri, statementCoverage));
```

When users inspect coverage details, VS Code calls `loadDetailedCoverage` on the profile for line/branch/declaration coverage objects.

**Best practice:** Store coverage files in temp directory and clean up via `run.onDidDispose()`.

## Publish-Only Controllers

Controllers without run profiles can publish external results:

```typescript
const run = controller.createTestRun(request, 'Name', false);
```

Pass `false` to `persist` parameter to prevent retention.

## UI Integration

Add test-specific actions via `testing/item/context` menu contribution. Context keys: `testId`, `controllerId`, `testItemHasUri`.

Reveal tests programmatically:

```typescript
vscode.commands.executeCommand('vscode.revealTestInExplorer', testItem);
```
