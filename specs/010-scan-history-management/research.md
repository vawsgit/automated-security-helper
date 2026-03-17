# Research: Scan History & Management

**Branch**: `010-scan-history-management` | **Date**: 2026-03-17

## Summary

No unknowns identified. All patterns are established from Specs 006-009. Key discovery: the tree provider already queries real data — scope is constitution compliance (service routing) plus deletion.

## Findings

### R1: ScanTreeProvider Already Uses Real Data (Corrective)

**Decision**: The ad-hoc spec described replacing mock data in `scanTreeProvider.ts`, but the provider already queries `db.scan.findMany()` directly. No mock replacement needed.

**Actual scope**: Route `scanTreeProvider` through `FindingsService.getScanSummaries()` instead of direct Prisma calls, per the constitution's service-layer convention.

**Rationale**: Constitution requires "Domain queries MUST go through service classes, not inline Prisma calls in providers." The existing `FindingsService.getScanSummaries()` performs the identical query.

### R2: Cascade Delete Already Configured (Confirmatory)

**Decision**: Use Prisma's existing `onDelete: Cascade` on the Finding→Scan relation. No additional cascade logic needed.

**Rationale**: The schema already has `@relation(fields: [scanId], references: [id], onDelete: Cascade)` on Finding. Deleting a Scan record automatically removes all associated Findings.

**Alternatives considered**: Application-level cascade (delete findings first, then scan). Rejected — redundant with DB-level cascade and adds error surface.

### R3: Tree View Context Menu for Delete (Confirmatory)

**Decision**: Register `ashWorkbench.deleteScan` as a VS Code command with a tree view context menu entry filtered by `viewItem`.

**Rationale**: The existing `ScanTreeItem` sets `contextValue = 'scan.${status}'` (e.g., `scan.completed`). Using `viewItem =~ /scan\.(completed|failed|cancelled)/` shows the delete option only for non-running scans.

**Alternatives considered**: Inline delete button on tree items. Rejected — VS Code tree items don't support inline buttons natively; context menu is the standard pattern.

### R4: SidebarWebviewProvider Inline DB Cleanup (Corrective)

**Decision**: Remove the inline DB fallback in `sidebarWebviewProvider.ts` lines 88-105 and the inline `db.finding.findMany()` on line 159.

**Rationale**: `FindingsService` is always injected now (since Spec 006). The fallback path is dead code. The inline finding query violates the constitution's service-layer rule.

### R5: Delete Command Argument Passing (Confirmatory)

**Decision**: The tree item's `contextValue` controls menu visibility, but the delete command needs the `scanId`. Pass it via the command arguments from the tree item.

**Rationale**: VS Code passes the tree item as the first argument to context menu commands. The `ScanTreeItem` has `scan.id` accessible. The command handler extracts the ID from the tree item.
