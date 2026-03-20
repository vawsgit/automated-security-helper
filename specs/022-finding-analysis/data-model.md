# Data Model: Finding Analysis — Core AI Feature

**Branch**: `022-finding-analysis` | **Date**: 2026-03-20

## Existing Entities (No Schema Changes)

The database schema requires **no modifications**. All entities and fields needed for this feature already exist from Specs 018-021.

### Finding (Prisma model)

```
Finding {
  id            String    @id @default(uuid())
  scanId        String
  projectId     String
  scanTargetId  String
  ruleId        String
  ruleIds       Json?
  scanner       String
  severity      String
  file          String
  startLine     Int
  endLine       Int?
  title         String
  description   String
  snippet       String?
  notes         String?
  disposition   String    @default("PENDING")
  aiAnalysis    Json?     // Stores StoredAiAnalysis { analysis, metadata }

  @@index([scanTargetId, ruleId, file])
  @@index([scanId, severity])
}
```

### StoredAiAnalysis (JSON structure in Finding.aiAnalysis)

```
StoredAiAnalysis {
  analysis: AiAnalysis {
    explanation: string
    riskAssessment: RiskAssessment {
      exploitability: RiskLevel        // CRITICAL | HIGH | MEDIUM | LOW | NONE
      exploitabilityRationale: string
      impact: RiskLevel
      impactRationale: string
      likelihood: RiskLevel
      likelihoodRationale: string
    }
    suggestedFix: SuggestedFix | null {
      description: string
      diffText: string
      language: string
    }
    references: AiReference[] {
      title: string
      url: string
    }
  }
  metadata: AnalysisMetadata {
    analyzedAt: string                 // ISO 8601 timestamp
    modelId: string                    // e.g., "claude-sonnet-4-6-20250514"
    costUsd: number                    // e.g., 0.037
    toolsUsed: string[]                // e.g., ["Read", "Grep", "get_finding_context"]
  }
}
```

## View-Layer Type Changes

### FindingRow (extend existing)

**Current**: `aiAnalysis: AiAnalysis | null`

**New**: Add `analysisMetadata: AnalysisMetadata | null`

Both fields are populated from the same `StoredAiAnalysis` JSON. The mapper extracts `stored.analysis` → `aiAnalysis` and `stored.metadata` → `analysisMetadata`.

### AnalysisUIState (new, WebView-only)

Transient UI state for in-flight analysis. Not persisted. Tracked per finding ID.

```
AnalysisUIState {
  status: 'analyzing' | 'error'
  message: string                      // Latest progress or error message
  toolName?: string                    // Current tool being used
  errorType?: string                   // Error category for guidance
}
```

**Lifecycle**:
- Created on `aiAnalysisStarted` → `{ status: 'analyzing', message: 'Starting analysis…' }`
- Updated on `aiAnalysisProgress` → `{ status: 'analyzing', message, toolName }`
- Removed on `aiAnalysisResult` (analysis now in FindingRow.aiAnalysis)
- Set to error on `aiAnalysisError` → `{ status: 'error', message, errorType }`
- Cleared when user dismisses error or navigates away

## Queries for Custom MCP Tools

### get_finding_context

```
Input: { findingId: string }
Query: FindingsService.getFindingDetail(findingId)
+ fs.readFile(finding.filePath) to get surrounding code (±20 lines)
Output: {
  finding: FindingRow (full detail),
  surroundingCode: string (lines startLine-20 to endLine+20),
  fileExists: boolean
}
```

### list_related_findings

```
Input: { findingId: string }
Query:
  1. Get target finding to obtain scanId, ruleId, scanner, file
  2. Prisma: Finding.findMany({
       where: {
         scanId: target.scanId,
         id: { not: findingId },
         OR: [
           { ruleId: target.ruleId },
           { scanner: target.scanner },
           { file: target.file },
         ]
       },
       take: 25
     })
Output: FindingRow[] (max 25, same scan only per clarification)
```
