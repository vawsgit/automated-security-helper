# Implementation Plan: Finding Triage

**Branch**: `009-finding-triage` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-finding-triage/spec.md`

## Summary

Route the `setDisposition` handler through `FindingsService`, add a `notes` column to the Finding schema, add `setNotes` service method and message handler, and update the mapper to read notes from the database. This completes the triage persistence layer so disposition and notes survive extension reloads.

## Technical Context

**Language/Version**: TypeScript / ES2022 target, Node16 modules, strict mode
**Primary Dependencies**: VS Code API (existing), Prisma ORM (existing), FindingsService (Spec 006/008)
**Storage**: PGLite (existing) -- schema migration needed for notes column
**Testing**: Mocha (unit, Node.js) + sinon for mocking. Existing `findings.test.ts` from Spec 008
**Target Platform**: VS Code ^1.110.0
**Project Type**: VS Code extension
**Performance Goals**: Disposition and notes updates persist within 200ms (SC-001)
**Constraints**: Schema migration for notes column. Message types need sync between vsix and webview.
**Scale/Scope**: Single finding update per user action, single concurrent panel

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. VS Code Native | PASS | All logic in extension host. No external services. Database runs in-process as WASM. |
| II. Extension Host Owns State | PASS | Disposition and notes updates run in extension host service layer. WebView sends action via typed message, receives confirmation push. |
| III. Ship Fast / Simplicity First | PASS | Two new service methods, one schema column, one new message type. No new abstractions. |
| IV. Typed Contracts at Boundaries | PASS | New `setNotes` message type added to discriminated unions in both vsix and webview. `notesUpdated` response type added similarly. |
| V. Theme Integration | N/A | No UI changes -- WebView triage controls already exist. |
| VI. Security by Default | PASS | No user input in SQL (Prisma parameterizes). Notes stored as plain text with UI-enforced length limit. |

**Gate result**: PASS -- no violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-finding-triage/
├── plan.md              # This file
├── research.md          # Phase 0 output (confirmatory -- no unknowns)
├── data-model.md        # Phase 1 output (notes column addition)
└── quickstart.md        # Phase 1 output (developer quickstart)
```

### Source Code (repository root)

```text
workbench/vsix/
├── prisma/
│   └── schema.prisma                     # MODIFY: Add notes column to Finding
├── src/
│   ├── services/
│   │   └── findings.ts                   # MODIFY: Add setDisposition() and setNotes() methods
│   ├── providers/
│   │   └── findingsPanelManager.ts       # MODIFY: Route setDisposition through service, add setNotes handler
│   ├── models/
│   │   ├── messages.ts                   # MODIFY: Add setNotes and notesUpdated message types
│   │   └── mappers.ts                    # MODIFY: Read notes from DB instead of hardcoded ''
│   └── test/unit/
│       └── findings.test.ts              # MODIFY: Add tests for setDisposition and setNotes
workbench/webview/src/types/
│   └── messages.ts                       # MODIFY: Mirror new message types
```

**Structure Decision**: No new files. All changes are modifications to existing files. The schema migration is handled by PGLite's push-based migration (no migration files).

## Design Decisions

### D1: Add setDisposition() to FindingsService

The `setDisposition` handler in `findingsPanelManager.ts` (lines 166-181) currently calls `this.db.finding.update()` directly. Per the constitution: "Domain queries MUST go through service classes." The service method wraps the update + mapper call, returning `FindingRow` for consistency.

**Signature**: `setDisposition(findingId: string, disposition: Disposition): Promise<FindingRow>`

**Alternative rejected**: Leaving the inline call. Same rationale as Spec 008 -- consistency with established convention.

### D2: Add setNotes() to FindingsService

New method for persisting notes on a finding.

**Signature**: `setNotes(findingId: string, notes: string): Promise<FindingRow>`

The method updates the `notes` field on the Finding record and returns the mapped `FindingRow`. No server-side length validation -- the 500-char limit is enforced by the WebView UI per spec.

### D3: Add notes Column to Prisma Schema

The Finding model gains a nullable `notes` String column:

```prisma
notes       String?
```

Nullable with implicit null default. The mapper reads `finding.notes ?? ''` to produce the `FindingRow.notes` string.

**Why nullable**: New findings from scans have no notes. A required field with a default empty string would also work, but nullable is more semantically accurate -- "no notes" vs "empty notes."

### D4: New Message Types

**WebView -> Extension Host**:
- `setNotes`: `{ type: 'setNotes'; payload: { findingId: string; notes: string } }`

**Extension Host -> WebView**:
- `notesUpdated`: `{ type: 'notesUpdated'; payload: { findingId: string; notes: string } }`

Both added to the discriminated unions in `vsix/src/models/messages.ts` and mirrored in `webview/src/types/messages.ts`.

### D5: setNotes Handler Pattern

The `setNotes` handler in `findingsPanelManager.ts` follows the same pattern as `setDisposition`:

1. Guard on `this.findingsService` existence
2. Call `this.findingsService.setNotes()`
3. Post `notesUpdated` message to WebView
4. No `postStateUpdate()` call -- notes don't affect summary counts

### D6: Update mapFindingToRow for notes

Change `notes: ''` to `notes: finding.notes ?? ''` in `mappers.ts` so the notes field is populated from the database.

## Modification Details

### `prisma/schema.prisma` -- Changes

Add `notes` column to Finding model:

```prisma
model Finding {
  ...
  snippet      String?
  notes        String?          // NEW: Triage notes (plain text)
  disposition  Disposition @default(PENDING)
  ...
}
```

After the schema change, run `npx prisma db push` (PGLite uses push-based migration).

### `findings.ts` -- Changes

Add two new methods to `FindingsService`:

```typescript
async setDisposition(findingId: string, disposition: Disposition): Promise<FindingRow> {
  const updated = await this.db.finding.update({
    where: { id: findingId },
    data: { disposition },
  });
  return mapFindingToRow(updated);
}

async setNotes(findingId: string, notes: string): Promise<FindingRow> {
  const updated = await this.db.finding.update({
    where: { id: findingId },
    data: { notes },
  });
  return mapFindingToRow(updated);
}
```

### `findingsPanelManager.ts` -- Changes

**Replace `setDisposition` case** (lines 166-181):

```typescript
case 'setDisposition': {
  if (this.findingsService) {
    try {
      const updated = await this.findingsService.setDisposition(
        message.payload.findingId,
        message.payload.disposition,
      );
      this.panel?.webview.postMessage({
        type: 'dispositionUpdated',
        payload: { findingId: updated.id, disposition: updated.disposition },
      });
      await this.postStateUpdate();
    } catch (err) {
      console.error('[ASH] Failed to update disposition:', err);
    }
  }
  break;
}
```

**Add `setNotes` case**:

```typescript
case 'setNotes': {
  if (this.findingsService) {
    try {
      const updated = await this.findingsService.setNotes(
        message.payload.findingId,
        message.payload.notes,
      );
      this.panel?.webview.postMessage({
        type: 'notesUpdated',
        payload: { findingId: updated.id, notes: updated.notes },
      });
    } catch (err) {
      console.error('[ASH] Failed to update notes:', err);
    }
  }
  break;
}
```

Also remove the `PrismaClient` constructor parameter and `this.db` field if no other handler uses it directly after this change.

### `messages.ts` (vsix) -- Changes

Add to `WebviewToExtMessage`:
```typescript
| { type: 'setNotes'; payload: { findingId: string; notes: string } }
```

Add to `ExtToWebviewMessage`:
```typescript
| { type: 'notesUpdated'; payload: { findingId: string; notes: string } }
```

### `messages.ts` (webview) -- Changes

Mirror the same additions in `webview/src/types/messages.ts`.

### `mappers.ts` -- Changes

Change line 62 in `mapFindingToRow`:
```typescript
// Before:
notes: '',
// After:
notes: finding.notes ?? '',
```

### `findings.test.ts` -- Changes

Add tests:

1. **Test: setDisposition updates and returns mapped FindingRow** -- Create finding, call `setDisposition('FIX')`, verify disposition changed
2. **Test: setNotes updates and returns mapped FindingRow** -- Create finding, call `setNotes('reason')`, verify notes persisted
3. **Test: setDisposition throws for non-existent finding** -- Call with bad ID, verify error thrown
4. **Test: notes field maps from database** -- Create finding with notes, call `getFindingDetail()`, verify notes populated

## Post-Design Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. VS Code Native | PASS | In-process DB, no external deps |
| II. Extension Host Owns State | PASS | Updates in service layer, WebView sends/receives typed messages |
| III. Ship Fast / Simplicity First | PASS | Two service methods, one schema column, one new message handler |
| IV. Typed Contracts at Boundaries | PASS | New message types in discriminated unions, synced across packages |
| V. Theme Integration | N/A | No UI changes |
| VI. Security by Default | PASS | Prisma parameterized queries, UI-enforced length limits |

**Re-check result**: PASS -- no violations, no complexity tracking needed.
