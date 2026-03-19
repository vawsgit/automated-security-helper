# Contract: AshYamlService

**Branch**: `014-ash-yaml-suppression` | **Date**: 2026-03-19

## Service Interface

The AshYamlService is an extension host domain service that reads `.ash.yaml` configuration files, caches parsed state, matches findings against suppression rules, and emits change events.

### Constructor

```
AshYamlService(scanRoot: string)
```

- Immediately discovers and parses the config file from `scanRoot`
- Sets up file system watchers for the scan root
- If no config file found, initializes with default empty configuration

### Public API

#### Configuration Access

| Method               | Signature                          | Description                                      |
| -------------------- | ---------------------------------- | ------------------------------------------------ |
| `getConfig()`        | `(): AshYamlConfig`               | Returns the currently cached configuration        |
| `getSuppressions()`  | `(): AshSuppression[]`            | Shorthand for `getConfig().suppressions`          |

#### Suppression Matching

| Method                      | Signature                                                        | Description                                              |
| --------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| `matchesSuppression()`      | `(finding: FindingRow): AshSuppression \| null`                  | Returns first matching suppression or null                |
| `getMatchingSuppressions()` | `(findings: FindingRow[]): Map<string, AshSuppression>`          | Batch match: Map of findingId → matching suppression      |

#### Lifecycle

| Method           | Signature                   | Description                                         |
| ---------------- | --------------------------- | --------------------------------------------------- |
| `setScanRoot()`  | `(newRoot: string): void`   | Updates scan root, re-discovers config, re-watches   |
| `dispose()`      | `(): void`                  | Disposes file watchers, clears debounce timer         |

#### Events

| Event                | Type                              | Fires when                                     |
| -------------------- | --------------------------------- | ---------------------------------------------- |
| `onDidChangeConfig`  | `vscode.Event<AshYamlConfig>`     | Config file created, changed, deleted, or scan root changed |

### Matching Algorithm Contract

Given a `FindingRow` and an `AshSuppression[]`:

```
For each suppression in order:
  1. If suppression.expiration is set and parseable and < today → SKIP
  2. If suppression.expiration is set but unparseable → SKIP + warn
  3. If suppression.rule_id is set:
     - If finding.ruleId is empty → NO MATCH
     - If !glob(finding.ruleId, suppression.rule_id) → NO MATCH
  4. If !glob(finding.filePath, suppression.path) → NO MATCH
  5. Line range check:
     a. If neither line_start nor line_end set → MATCH (any line)
     b. If finding has no line info (startLine=0, endLine=0) but suppression has range → NO MATCH
     c. If only line_start set → finding.startLine >= suppression.line_start
     d. If only line_end set → finding.endLine <= suppression.line_end
     e. If both set → finding.startLine <= suppression.line_end AND finding.endLine >= suppression.line_start
  6. All checks passed → RETURN suppression (first match wins)

If no suppression matched → RETURN null
```

### Consumers

| Consumer                 | What it uses                               | When                              |
| ------------------------ | ------------------------------------------ | --------------------------------- |
| FindingsService          | `getMatchingSuppressions()`                | After loading findings for display |
| FindingsPanelManager     | `onDidChangeConfig`                        | Refresh finding detail on change   |
| SidebarWebviewProvider   | `onDidChangeConfig`                        | Refresh dashboard on change        |

### Error Handling Contract

| Error condition           | Behavior                                                        |
| ------------------------- | --------------------------------------------------------------- |
| No config file found      | Return default config, no error logged                          |
| Invalid YAML/JSON syntax  | Log warning, return default config for that file                |
| Valid YAML, bad structure | Parse valid sections, skip malformed sections with warning       |
| Missing required field    | Skip that individual rule/entry, log warning                    |
| File permission denied    | Log warning, return default config                              |
| Watcher creation fails    | Log warning, service still works with initial parse (no live updates) |
