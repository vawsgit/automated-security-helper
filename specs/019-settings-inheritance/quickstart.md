# Quickstart: Settings Inheritance and Configuration

## What This Feature Does

Adds a two-layer settings system: `~/.claude/settings.json` (Claude Code) is loaded as a default base layer, and VS Code `ashWorkbench.llm.*` settings serve as optional overrides. Existing Claude Code users get zero-config AI.

## Files to Modify

1. **`vsix/package.json`** — Add `awsProfile` and `awsAuthRefresh` settings to `contributes.configuration`
2. **`vsix/src/services/aiService.ts`** — Extend `AiServiceConfig` interface and `getConfig()` with new fields
3. **`vsix/src/services/claudeAgentProvider.ts`** — Extract `buildQueryOptions()`, use it in both `testConnection()` and `analyzeFinding()`
4. **`vsix/src/extension.ts`** — Add Claude settings detection at activation, expose result to dashboard providers

## New Files

5. **`vsix/src/services/claudeSettingsDetector.ts`** — Detection logic for `~/.claude/settings.json`
6. **`vsix/src/test/unit/claudeSettingsDetector.test.ts`** — Unit tests for detection
7. **`vsix/src/test/unit/buildQueryOptions.test.ts`** — Unit tests for options builder

## Key Patterns

- Setting scope restriction: `"scope": "application"` in package.json for `awsAuthRefresh`
- SDK env overrides: Spread `process.env` with non-empty settings mapped to env var names
- Detection: Direct `fs.readFile` + JSON parse at activation, not SDK-dependent

## Verification

```bash
cd vsix
npm run compile   # TypeScript compiles clean
npm run lint      # No lint errors
npm run test      # New unit tests pass
```
