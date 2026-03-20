# Data Model: Settings Inheritance and Configuration

## Entities

### AiServiceConfig (Updated)

The configuration object read from VS Code settings. Extended with two new fields.

| Field            | Type                      | Default       | Source              | Notes                                       |
| ---------------- | ------------------------- | ------------- | ------------------- | ------------------------------------------- |
| provider         | `string`                  | `''`          | VS Code (override)  | `'bedrock'` or `'anthropic-api'` or empty   |
| region           | `string`                  | `''`          | VS Code (override)  | AWS region, empty = inherit                 |
| modelId          | `string`                  | `''`          | VS Code (override)  | Model identifier, empty = inherit           |
| awsProfile       | `string`                  | `''`          | VS Code (override)  | **NEW** — AWS profile name, empty = inherit |
| awsAuthRefresh   | `string`                  | `''`          | VS Code (user-only) | **NEW** — Shell command for cred rotation   |
| useClaudeSettings | `boolean`                | `true`        | VS Code             | Load `~/.claude/settings.json` as base      |
| maxBudgetUsd     | `number`                  | `1.0`         | VS Code (always)    | Never inherited from Claude Code            |
| maxTurns         | `number`                  | `15`          | VS Code (always)    | Never inherited from Claude Code            |
| toolMode         | `'read-only' \| 'full'`  | `'read-only'` | VS Code (always)    | Never inherited from Claude Code            |

### ClaudeSettingsDetection

Result of activation-time detection. Not persisted — computed once and held in memory.

| Field                   | Type      | Description                                                        |
| ----------------------- | --------- | ------------------------------------------------------------------ |
| claudeSettingsDetected  | `boolean` | True if `~/.claude/settings.json` exists with provider config      |
| detectedProvider        | `string`  | `'bedrock'`, `'anthropic-api'`, or `'none'` — the detected config  |

## Relationships

```
AiServiceConfig ──produces──> SDK Query Options (via buildQueryOptions)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
           settingSources      model override   env overrides
          (base layer)        (if non-empty)    (if non-empty)

ClaudeSettingsDetection ──read by──> Dashboard (contextual guidance)
```

## State Transitions

None — `AiServiceConfig` is a value object read fresh on each `getConfig()` call. `ClaudeSettingsDetection` is computed once at activation and is immutable.
