# Tasks: Scan History & Management

**Input**: Design documents from `/specs/010-scan-history-management/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Included -- the plan specifies 3 test cases for the deleteScan service method.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Foundational

**Purpose**: Message types, service method, and tests that US2 depends on. US1 can begin in parallel.

- [x] T001 [P] Add `deleteScan` to `WebviewToExtMessage` discriminated union in `vsix/src/models/messages.ts`: `{ type: 'deleteScan'; payload: { scanId: string } }`
- [x] T002 [P] Mirror the `deleteScan` message type addition in `webview/src/types/messages.ts`
- [x] T003 Add `deleteScan(scanId: string): Promise<void>` method to `FindingsService` that guards against RUNNING status, then calls `db.scan.delete()` (cascade handles findings), in `vsix/src/services/findings.ts`
- [x] T004 Add `describe('deleteScan')` test block to `vsix/src/test/unit/findings.test.ts` with: (1) deleteScan removes scan and cascaded findings, (2) deleteScan throws for non-existent scan ID, (3) deleteScan throws for RUNNING scan

**Checkpoint**: Service method exists and is tested. Message types synced across packages. US2 implementation can begin.

---

## Phase 2: User Story 1 -- View Real Scan History (Priority: P1)

**Goal**: Route `scanTreeProvider` and `sidebarWebviewProvider` through `FindingsService` instead of direct Prisma calls (constitution compliance).

**Independent Test**: Run a scan, verify the sidebar tree shows real scan data with correct status, date, finding count. Click a scan to open findings.

### Implementation for User Story 1

- [x] T005 [US1] Refactor `ScanTreeProvider` to remove `PrismaClient` and `Project` constructor params, add `setFindingsService(service: FindingsService)` setter, change `getChildren()` to call `this.findingsService.getScanSummaries()`, in `vsix/src/providers/scanTreeProvider.ts`
- [x] T006 [US1] Clean up `SidebarWebviewProvider` inline DB queries: remove the fallback path (lines 88-105) in `queryStateAndPost()`, replace `this.db.finding.findMany()` (line 159) with `this.findingsService.getFindings()`, remove `PrismaClient` and `Project` constructor params if no longer used, in `vsix/src/providers/sidebarWebviewProvider.ts`
- [x] T007 [US1] Update `extension.ts` for US1: change `ScanTreeProvider` constructor to no args, add `scanTreeProvider.setFindingsService(findingsService)`, update `SidebarWebviewProvider` constructor to remove `db`/`project` params if they were removed in T006

**Checkpoint**: Tree view and sidebar both route through FindingsService. No direct Prisma calls remain in providers. Existing behavior unchanged.

---

## Phase 3: User Story 2 -- Delete a Scan (Priority: P2)

**Goal**: Users can delete completed/failed/cancelled scans via tree view context menu and WebView, with cascade deletion of findings.

**Independent Test**: Right-click a completed scan in the tree, select "Delete Scan", confirm, verify scan and findings are removed from both views.

### Implementation for User Story 2

- [x] T008 [US2] Add `setScanTreeProvider(provider: ScanTreeProvider)` setter and `case 'deleteScan'` handler in `handleMessage()` that calls `findingsService.deleteScan()`, `postStateUpdate()`, and `scanTreeProvider.refresh()`, in `vsix/src/providers/findingsPanelManager.ts`
- [x] T009 [US2] Add `case 'deleteScan'` handler in `handleMessage()` that calls `findingsService.deleteScan()`, `queryStateAndPost()`, and `scanTreeProvider.refresh()`, in `vsix/src/providers/sidebarWebviewProvider.ts`
- [x] T010 [US2] Add `ashWorkbench.deleteScan` command entry and context menu entry (`viewItem =~ /scan\\.(completed|failed|cancelled)/`) to `vsix/package.json`
- [x] T011 [US2] Register `ashWorkbench.deleteScan` command in `extension.ts` with `showWarningMessage` modal confirmation dialog, wire `findingsPanelManager.setScanTreeProvider(scanTreeProvider)`

**Checkpoint**: Deletion works from tree context menu with confirmation. Both views refresh after deletion.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Verify everything compiles, all tests pass, no regressions.

- [x] T012 Run `npm run compile` in `vsix/` and verify zero TypeScript errors
- [x] T013 Run `npm run test` in `vsix/` and verify all tests pass (existing + new deleteScan tests)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies -- can start immediately. T001 and T002 are parallel (different packages). T003 depends on nothing. T004 depends on T003.
- **US1 (Phase 2)**: No dependency on Phase 1. T005 and T006 can run in parallel (different files). T007 depends on T005+T006.
- **US2 (Phase 3)**: Depends on Phase 1 (needs `deleteScan()` service method from T003). T008 and T009 are parallel (different files). T010 is independent (package.json). T011 depends on T008+T009+T010.
- **Polish (Phase 4)**: Depends on all previous phases.

### User Story Dependencies

- **US1 (P1)**: Independent. Can start immediately (no dependency on Phase 1).
- **US2 (P2)**: Depends on Phase 1 only (needs deleteScan service method). No dependency on US1.

Both user stories can run in parallel (US1 starts from Phase 2 without waiting for Phase 1).

### Parallel Opportunities

Within Phase 1:
- T001 and T002 can run in parallel (different packages: vsix vs webview)

Within Phase 2 (US1):
- T005 and T006 can run in parallel (different provider files)

Within Phase 3 (US2):
- T008, T009, and T010 can run in parallel (different files: findingsPanelManager, sidebarWebviewProvider, package.json)

Across Phases:
- US1 (Phase 2) and Phase 1 can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: US1 (T005, T006, T007)
2. **STOP and VALIDATE**: Run `npm run compile` + `npm run test`. Launch extension host (F5), run a scan, verify tree shows real data, click scan to open findings.

### Incremental Delivery

1. T001-T004 → Message types + service method + tests (Foundation!)
2. T005-T007 → Service routing for providers (Constitution compliance!)
3. T008-T011 → Delete command + handlers (Full feature!)
4. T012-T013 → Full compile + test verification

---

## Notes

- `vsix/src/services/findings.ts` gains ~10 lines (deleteScan method)
- `vsix/src/providers/scanTreeProvider.ts` changes ~10 lines (constructor + getChildren)
- `vsix/src/providers/findingsPanelManager.ts` gains ~15 lines (setter + handler)
- `vsix/src/providers/sidebarWebviewProvider.ts` changes ~20 lines (remove fallback, replace inline DB, add handler, remove constructor params)
- `vsix/src/extension.ts` changes ~10 lines (constructor calls, setters, command registration)
- `vsix/src/models/messages.ts` gains 1 line (deleteScan type)
- `webview/src/types/messages.ts` gains 1 line (mirrored type)
- `vsix/package.json` gains ~10 lines (command + menu entry)
- `vsix/src/test/unit/findings.test.ts` gains ~3 test cases
- T007 and T011 both modify extension.ts -- execute T007 before T011 (US1 before US2)
