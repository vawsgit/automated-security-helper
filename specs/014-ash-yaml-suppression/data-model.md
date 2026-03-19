# Data Model: .ash.yaml Read Service & Suppression Matching

**Branch**: `014-ash-yaml-suppression` | **Date**: 2026-03-19

## Entities

### AshSuppression

A suppression rule parsed from `.ash.yaml`'s `global_settings.suppressions` array.

| Field        | Type               | Required | Default   | Description                                      |
| ------------ | ------------------ | -------- | --------- | ------------------------------------------------ |
| `path`       | `string`           | Yes      | —         | File path or glob pattern to match findings       |
| `reason`     | `string`           | Yes      | —         | Justification text for the suppression            |
| `rule_id`    | `string \| null`   | No       | `null`    | Scanner rule ID or glob pattern; null = match all |
| `line_start` | `number \| null`   | No       | `null`    | Start line of suppressed range                    |
| `line_end`   | `number \| null`   | No       | `null`    | End line of suppressed range (>= line_start)      |
| `expiration` | `string \| null`   | No       | `null`    | Expiration date in YYYY-MM-DD format              |

**Validation rules**:
- `path` and `reason` are required; rules missing either are skipped with a warning
- If both `line_start` and `line_end` are present, `line_end >= line_start`; invalid → skip line range check
- `expiration` must parse as YYYY-MM-DD; invalid → treat as non-expiring with warning

### AshIgnorePath

An ignored path entry parsed from `.ash.yaml`'s `global_settings.ignore_paths` array.

| Field        | Type             | Required | Default | Description                         |
| ------------ | ---------------- | -------- | ------- | ----------------------------------- |
| `path`       | `string`         | Yes      | —       | File path or glob pattern to ignore |
| `reason`     | `string`         | Yes      | —       | Reason for exclusion                |
| `expiration` | `string \| null` | No       | `null`  | Expiration date in YYYY-MM-DD       |

**Validation rules**:
- `path` and `reason` are required; entries missing either are skipped with a warning

### AshScannerEntry

A scanner configuration entry parsed from `.ash.yaml`'s `scanners` section.

| Field     | Type      | Required | Default | Description                  |
| --------- | --------- | -------- | ------- | ---------------------------- |
| `name`    | `string`  | Yes      | —       | Scanner name (the YAML key)  |
| `enabled` | `boolean` | Yes      | —       | Whether the scanner is active |

### AshYamlConfig

The complete parsed state of an ASH configuration file.

| Field                | Type                                                            | Default        | Description                          |
| -------------------- | --------------------------------------------------------------- | -------------- | ------------------------------------ |
| `suppressions`       | `AshSuppression[]`                                              | `[]`           | Suppression rules                    |
| `ignorePaths`        | `AshIgnorePath[]`                                               | `[]`           | Ignored path entries                 |
| `severityThreshold`  | `'ALL' \| 'LOW' \| 'MEDIUM' \| 'HIGH' \| 'CRITICAL'`          | `'MEDIUM'`     | Minimum severity to report           |
| `projectName`        | `string`                                                        | `'ash-scan'`   | Project name from config             |
| `scanners`           | `AshScannerEntry[]`                                             | `[]`           | Scanner configurations               |
| `failOnFindings`     | `boolean`                                                       | `true`         | Whether findings cause failure       |
| `configFilePath`     | `string \| null`                                                | `null`         | Absolute path to the discovered file |

**Notes**:
- `configFilePath` is `null` when no config file was found (default state)
- All arrays default to empty when no config file exists or section is malformed
- `severityThreshold` and `failOnFindings` use CLI defaults when not specified

## Relationships

```
AshYamlConfig
├── suppressions: AshSuppression[]        (0..N)
├── ignorePaths: AshIgnorePath[]          (0..N)
└── scanners: AshScannerEntry[]           (0..N)

FindingRow (existing, read-only for matching)
├── ruleId: string           → matched against AshSuppression.rule_id
├── filePath: string         → matched against AshSuppression.path
├── startLine: number        → matched against AshSuppression.line_start/line_end
└── endLine: number          → matched against AshSuppression.line_start/line_end
```

## Default Configuration

When no config file is found or the file is entirely unparseable:

```typescript
const DEFAULT_CONFIG: AshYamlConfig = {
  suppressions: [],
  ignorePaths: [],
  severityThreshold: 'MEDIUM',
  projectName: 'ash-scan',
  scanners: [],
  failOnFindings: true,
  configFilePath: null,
};
```

## YAML-to-TypeScript Field Mapping

| YAML Path                            | TypeScript Field                      |
| ------------------------------------ | ------------------------------------- |
| `project_name`                       | `AshYamlConfig.projectName`           |
| `global_settings.suppressions`       | `AshYamlConfig.suppressions`          |
| `global_settings.suppressions[].path`       | `AshSuppression.path`         |
| `global_settings.suppressions[].reason`     | `AshSuppression.reason`       |
| `global_settings.suppressions[].rule_id`    | `AshSuppression.rule_id`      |
| `global_settings.suppressions[].line_start` | `AshSuppression.line_start`   |
| `global_settings.suppressions[].line_end`   | `AshSuppression.line_end`     |
| `global_settings.suppressions[].expiration` | `AshSuppression.expiration`   |
| `global_settings.ignore_paths`       | `AshYamlConfig.ignorePaths`           |
| `global_settings.ignore_paths[].path`       | `AshIgnorePath.path`          |
| `global_settings.ignore_paths[].reason`     | `AshIgnorePath.reason`        |
| `global_settings.ignore_paths[].expiration` | `AshIgnorePath.expiration`    |
| `global_settings.severity_threshold` | `AshYamlConfig.severityThreshold`     |
| `fail_on_findings`                   | `AshYamlConfig.failOnFindings`        |
| `scanners` (object keys)             | `AshYamlConfig.scanners[].name`       |
| `scanners.{name}.enabled`            | `AshYamlConfig.scanners[].enabled`    |
