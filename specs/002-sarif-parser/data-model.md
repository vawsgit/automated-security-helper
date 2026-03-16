# Data Model: SARIF Parser

**Feature**: 002-sarif-parser
**Date**: 2026-03-16

---

## Entities

### ParsedFinding (Output)

The intermediate finding type produced by the parser. Contains all data extracted from SARIF, without database identity fields.

| Field | Type | Required | Default | Source |
|-------|------|----------|---------|--------|
| ruleId | string | Yes | `"unknown"` | `result.ruleId` |
| scanner | string | Yes | — | `run.tool.driver.name` |
| severity | Severity | Yes | — | `result.properties.severity` or `result.level` mapping |
| file | string | Yes | `"unknown"` | `result.locations[0].physicalLocation.artifactLocation.uri` (normalized) |
| startLine | number | Yes | `1` | `result.locations[0].physicalLocation.region.startLine` |
| endLine | number | No | `undefined` | `result.locations[0].physicalLocation.region.endLine` |
| title | string | Yes | — | `run.tool.driver.rules[].shortDescription.text` or `result.message.text` |
| description | string | Yes | — | `result.message.text` |
| snippet | string | No | `undefined` | `result.locations[0].physicalLocation.region.snippet.text` |

**Notes**:
- No `id`, `scanId`, `projectId`, or `scanTargetId` — those are added by the storage layer (Spec 004)
- No `disposition` — defaults to `PENDING` at storage time
- `scanner` may contain comma-separated names after deduplication (e.g., `"bandit, semgrep"`)

### Severity (Enum)

```
CRITICAL | HIGH | MEDIUM | LOW | INFO
```

Matches the database `Severity` enum exactly.

### Mapping from Database Finding

| ParsedFinding Field | Database Finding Field | Transform |
|---------------------|----------------------|-----------|
| ruleId | ruleId | Direct |
| scanner | scanner | Direct (string, comma-separated if deduped) |
| severity | severity | Direct (same enum) |
| file | file | Direct (already relative) |
| startLine | startLine | Direct |
| endLine | endLine | Direct |
| title | title | Direct |
| description | description | Direct |
| snippet | snippet | Direct |
| — | id | Added by storage (UUID) |
| — | scanId | Added by storage (FK) |
| — | projectId | Added by storage (FK) |
| — | scanTargetId | Added by storage (FK) |
| — | ruleIds | Optionally populated by storage for cross-scanner tracking |
| — | disposition | Defaults to PENDING at storage |

## SARIF Input Structure

### SarifLog

```
SarifLog
├── version: "2.1.0"
├── $schema?: string
└── runs: SarifRun[]
    ├── tool.driver.name: string (scanner name)
    ├── tool.driver.rules: Rule[] (rule metadata)
    │   ├── id: string
    │   └── shortDescription?: { text: string }
    └── results: SarifResult[]
        ├── ruleId: string
        ├── level: "error" | "warning" | "note" | "none"
        ├── message: { text: string }
        ├── locations: Location[]
        │   └── physicalLocation
        │       ├── artifactLocation: { uri: string }
        │       └── region?
        │           ├── startLine: number
        │           ├── endLine?: number
        │           └── snippet?: { text: string }
        └── properties?: Record<string, unknown>
            ├── severity?: string (ASH-specific)
            └── "ash/severity"?: string (ASH-specific)
```

## Severity Mapping

| Source | Priority | Mapping |
|--------|----------|---------|
| `result.properties.severity` | 1 (highest) | Direct uppercase: `"CRITICAL"`, `"HIGH"`, etc. |
| `result.properties['ash/severity']` | 2 | Direct uppercase |
| `result.level = "error"` | 3 (fallback) | → `HIGH` |
| `result.level = "warning"` | 3 | → `MEDIUM` |
| `result.level = "note"` | 3 | → `LOW` |
| `result.level = "none"` | 3 | → `INFO` |
| `result.level` missing | 3 | → `MEDIUM` (SARIF default is `"warning"`) |

## Deduplication Rules

**Key**: `(ruleId, file)`

**Merge strategy** for findings sharing the same key:
- `startLine`: minimum of all startLines
- `endLine`: maximum of all endLines (if any are defined)
- `description`: longest text (most detailed)
- `scanner`: comma-separated concatenation of unique scanner names
- `title`: keep first non-empty title
- `snippet`: keep first non-empty snippet
- `severity`: keep highest severity (CRITICAL > HIGH > MEDIUM > LOW > INFO)
