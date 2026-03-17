# Data Model: ASH Console Output Channel

**Branch**: `007-ash-output-channel` | **Date**: 2026-03-17

## Summary

This feature introduces **no new entities, tables, or persistent data**. The Output Channel is an ephemeral, in-memory text stream managed by VS Code. It is cleared on each new scan and disposed on extension deactivation.

## Existing Entities (Unchanged)

No modifications to the existing data model (Project, ScanTarget, Scan, Finding). The feature reads from existing scan execution data (target path, finding count, scan status) but does not write to or alter any database records.

## Runtime State (New Instance Fields)

The following transient fields are added to `ScannerService`:

| Field | Type | Lifecycle | Purpose |
|-------|------|-----------|---------|
| `outputChannel` | `vscode.OutputChannel \| undefined` | Constructor → extension deactivation | Reference to the "ASH" Output Channel for writing scan output |
| `scanStartTime` | `number \| null` | Set at scan start, cleared at scan end | Timestamp for computing scan duration in footer (used by both `executeScan` and `cancelScan`) |

These are not persisted — they exist only in the `ScannerService` instance for the VS Code session lifetime.
