# Research: Settings Inheritance and Configuration

## R1: VS Code Setting Scope Restriction for `awsAuthRefresh`

**Decision**: Use `"scope": "application"` in the `package.json` configuration schema for `awsAuthRefresh`.

**Rationale**: VS Code's `scope` property controls where a setting can be configured:
- `"application"` — user-level only, cannot be overridden by workspace settings
- `"machine"` — machine-specific, user-level only
- `"window"` — default, can be set at workspace level
- `"resource"` — can vary per folder in multi-root workspaces

`"scope": "application"` is the correct choice because:
1. It prevents workspace `.vscode/settings.json` from injecting arbitrary shell commands
2. VS Code natively enforces this — the extension doesn't need custom validation logic
3. The setting still appears in the VS Code Settings UI under user-level settings

**Alternatives considered**:
- `"machine"` — Also restricts to user-level, but semantically implies machine-specific (not wrong, but `application` is clearer for this use case)
- Custom runtime validation (check `inspect()` for workspace-level value) — More complex, less reliable, VS Code already solves this

## R2: Claude Agent SDK `env` Override Mechanism

**Decision**: Pass environment variable overrides via the SDK `env` option, spread over `process.env`.

**Rationale**: The Claude Agent SDK `query()` accepts an `env: Record<string, string | undefined>` option that defaults to `process.env`. When `settingSources: ['user']` is used, the SDK loads `~/.claude/settings.json` which may contain its own `env` section. The precedence is:
1. SDK query `env` option → passed to the Claude Code subprocess as its environment
2. Settings file `env` section → applied internally by Claude Code at runtime

To override settings inherited from `~/.claude/settings.json`, we pass the override values through the SDK `env` option. The env keys used by Claude Code:
- `ANTHROPIC_MODEL` — overrides model selection
- `AWS_REGION` — overrides AWS region
- `AWS_PROFILE` — overrides AWS profile
- `CLAUDE_CODE_USE_BEDROCK=1` — selects Bedrock provider

However, the simpler approach for model override is the SDK's dedicated `model` option, which takes precedence. For provider/region/profile, env overrides via `env` option are the correct path.

**Alternatives considered**:
- Not passing `settingSources` and manually reproducing the settings file parsing — Duplicates SDK logic, fragile, misses credential rotation
- Passing env overrides as `extraArgs` — Not the right mechanism; `extraArgs` is for CLI flags, not env vars

## R3: Detection of `~/.claude/settings.json` Content

**Decision**: Read and parse `~/.claude/settings.json` directly at activation time using Node.js `fs` module. Check for specific keys in the parsed JSON.

**Rationale**: The detection needs to happen at activation time (before any SDK call), so we cannot use the SDK for this. The file is a plain JSON file with a known schema:
```json
{
  "env": {
    "CLAUDE_CODE_USE_BEDROCK": "1",
    "ANTHROPIC_API_KEY": "sk-..."
  },
  "permissions": { ... },
  "awsAuthRefresh": "command-here"
}
```

Detection checks:
1. File exists at `~/.claude/settings.json` (use `os.homedir()`)
2. File parses as valid JSON
3. Contains `env.CLAUDE_CODE_USE_BEDROCK` OR `awsAuthRefresh` (Bedrock)
4. Contains `env.ANTHROPIC_API_KEY` (Anthropic API)

**Alternatives considered**:
- Using the SDK to probe — Requires a full `query()` call, too slow for activation, overkill
- Using `vscode.workspace.fs` — `~/.claude/settings.json` is outside workspace; Node.js `fs` is simpler and available in extension host

## R4: `buildQueryOptions()` Design

**Decision**: Extract query option building into a standalone function that takes `AiServiceConfig` and returns the SDK options object. Keep it in `claudeAgentProvider.ts` as a module-level function (not a class method).

**Rationale**:
1. Both `testConnection()` and `analyzeFinding()` currently duplicate the same option-building logic (lines 273-286 and 364-380 of `claudeAgentProvider.ts`)
2. A standalone function is easier to unit test (no class instantiation needed)
3. Keeping it in `claudeAgentProvider.ts` maintains colocation with the SDK-specific code

The function signature:
```
buildQueryOptions(config: AiServiceConfig): Record<string, unknown>
```

Returns an options object with:
- `settingSources: ['user']` when `useClaudeSettings` is true
- `model` when `modelId` is non-empty
- `env` spread over `process.env` with overrides for non-empty `region`, `provider`, `awsProfile`, `awsAuthRefresh`

**Alternatives considered**:
- Separate `AiConfigService` class — Over-engineering; a pure function is sufficient
- Putting it in `aiService.ts` — Would create a dependency on SDK option types in the orchestrator layer
