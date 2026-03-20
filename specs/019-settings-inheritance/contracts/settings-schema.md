# Contract: VS Code Settings Schema

## Settings Declared in `package.json` contributes.configuration

All settings live under the `ashWorkbench.llm` namespace.

### Existing Settings (no changes except default/description refinement)

| Key                    | Type      | Default       | Scope    | Description                                    |
| ---------------------- | --------- | ------------- | -------- | ---------------------------------------------- |
| `provider`             | `string`  | `""`          | window   | `"bedrock"` or `"anthropic-api"`. Empty = inherit. |
| `region`               | `string`  | `""`          | window   | AWS region. Empty = inherit.                   |
| `modelId`              | `string`  | `""`          | window   | Model identifier. Empty = inherit.             |
| `useClaudeSettings`    | `boolean` | `true`        | window   | Load `~/.claude/settings.json` as base layer.  |
| `maxBudgetUsd`         | `number`  | `1.00`        | window   | Max USD per analysis. Min: 0.01.               |
| `toolMode`             | `string`  | `"read-only"` | window   | `"read-only"` or `"full"`.                     |
| `maxTurns`             | `number`  | `15`          | window   | Max reasoning iterations. Min: 1, Max: 50.     |

### New Settings

| Key                    | Type      | Default       | Scope         | Description                                    |
| ---------------------- | --------- | ------------- | ------------- | ---------------------------------------------- |
| `awsProfile`           | `string`  | `""`          | window        | AWS profile name. Empty = inherit.             |
| `awsAuthRefresh`       | `string`  | `""`          | **application** | Shell command for credential rotation. Empty = inherit. **User-level only** to prevent command injection. |

## buildQueryOptions() Contract

**Input**: `AiServiceConfig`
**Output**: SDK-compatible options object

### Merge Rules

1. If `useClaudeSettings === true` → set `settingSources: ['user']`
2. If `modelId !== ''` → set `model: modelId`
3. For each env-mappable override, if non-empty, add to `env` object:
   - `region` → `AWS_REGION`
   - `provider === 'bedrock'` → `CLAUDE_CODE_USE_BEDROCK=1`
   - `awsProfile` → `AWS_PROFILE`
   - `awsAuthRefresh` → not passed via env (SDK reads from settings file; override TBD based on SDK behavior)
4. If any env overrides exist → merge `{ ...process.env, ...overrides }` into `env`
5. `maxBudgetUsd`, `maxTurns`, `toolMode` are passed directly as SDK options (not env)

## Detection Contract

**Input**: None (reads `~/.claude/settings.json` from filesystem)
**Output**: `{ claudeSettingsDetected: boolean, detectedProvider: 'bedrock' | 'anthropic-api' | 'none' }`

### Detection Rules

1. Resolve path: `path.join(os.homedir(), '.claude', 'settings.json')`
2. If file doesn't exist → `{ claudeSettingsDetected: false, detectedProvider: 'none' }`
3. If file is malformed JSON → `{ claudeSettingsDetected: false, detectedProvider: 'none' }` + log warning
4. If `parsed.env?.CLAUDE_CODE_USE_BEDROCK` exists OR `parsed.awsAuthRefresh` exists → `detectedProvider: 'bedrock'`
5. Else if `parsed.env?.ANTHROPIC_API_KEY` exists → `detectedProvider: 'anthropic-api'`
6. Else → `{ claudeSettingsDetected: false, detectedProvider: 'none' }`
7. `claudeSettingsDetected = detectedProvider !== 'none'`
