# Quickstart: .ash.yaml Read Service & Suppression Matching

**Branch**: `014-ash-yaml-suppression` | **Date**: 2026-03-19

## Prerequisites

- Node.js 22+ and npm
- VS Code 1.110+
- Existing vsix/ and webview/ packages built (run `cd vsix && npm install`)

## New Dependencies

```bash
cd vsix
npm install js-yaml picomatch
npm install -D @types/js-yaml @types/picomatch
```

## Files to Create

| File                                    | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `vsix/src/services/ashYaml.ts`          | AshYamlService: config discovery, parsing, matching    |
| `vsix/src/test/unit/ashYaml.test.ts`    | Unit tests for parsing and matching logic              |

## Files to Modify

| File                                    | Change                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| `vsix/src/models/types.ts`              | Add AshSuppression, AshIgnorePath, AshScannerEntry, AshYamlConfig interfaces |
| `webview/src/types/types.ts`            | Mirror new interfaces from vsix types                  |
| `vsix/src/extension.ts`                 | Create AshYamlService, wire to providers, add to scan root change listener |
| `vsix/package.json`                     | Add js-yaml, picomatch to dependencies                 |

## Build & Test

```bash
cd vsix
npm run compile        # Verify TypeScript compiles cleanly
npm run lint           # Verify ESLint passes
npm run test           # Run all tests including new unit tests
```

## Verification Checklist

1. Create a test `.ash.yaml` in a workspace root:
   ```yaml
   global_settings:
     suppressions:
       - path: "src/**/*.py"
         reason: "Test suppression"
         rule_id: "B*"
   ```
2. Open the workspace in VS Code with the extension loaded
3. Run a scan — findings matching `B*` in `src/**/*.py` should be identifiable as suppressed
4. Edit `.ash.yaml` (add/remove a rule) — the service should re-parse within ~1 second
5. Delete `.ash.yaml` — the service should revert to empty configuration
6. Change `ashWorkbench.scanRoot` setting — the service should re-discover config from the new root
