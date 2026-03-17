# Research: ASH Console Output Channel

**Branch**: `007-ash-output-channel` | **Date**: 2026-03-17

## Summary

No unknowns or NEEDS CLARIFICATION items were identified in the Technical Context. This feature uses well-documented VS Code APIs and modifies existing, well-understood code. Research is confirmatory only.

## Decisions

### VS Code OutputChannel API (Plain vs Log)

- **Decision**: Use plain `OutputChannel` (via `vscode.window.createOutputChannel('ASH')`)
- **Rationale**: `LogOutputChannel` prepends timestamps and log-level prefixes to every line, which would corrupt the ASH CLI's own formatting. The channel shows raw CLI output, not extension diagnostics.
- **Alternatives considered**: `LogOutputChannel` — rejected because it reformats output. Terminal — rejected because it allows user input and doesn't support programmatic `clear()`.

### Partial Line Buffering Strategy

- **Decision**: Inline closure-based line buffer within `ScannerService`
- **Rationale**: Node.js `child_process` `data` events deliver arbitrary byte chunks. A line buffer that splits on `\n` and holds incomplete trailing data ensures clean line-by-line output. This is a standard Node.js pattern for stream processing.
- **Alternatives considered**: Third-party `readline` or `split2` — rejected as unnecessary dependency for a simple newline split. No buffering (raw `append()`) — rejected because partial lines in the Output Channel look broken.

### Channel Lifecycle (Clear vs Append)

- **Decision**: Clear the channel at the start of each scan (FR-010, clarification session)
- **Rationale**: User explicitly requested KISS — no session history accumulation. Clearing on each scan keeps the channel focused on the current/last run.
- **Alternatives considered**: Append with visual separators — rejected per user direction in clarification session 2026-03-17.

### OutputChannel Injection Pattern

- **Decision**: Optional constructor parameter on `ScannerService`
- **Rationale**: The channel is a service-lifetime dependency, available at construction time in `activate()`. Optional parameter preserves backward compatibility with existing tests that don't provide a channel.
- **Alternatives considered**: Setter method — rejected because channel should be immutable once set and available from first scan. Global/singleton — rejected as it violates dependency injection convention.

### Duration Format

- **Decision**: `Xs` for scans under 60 seconds, `Xm Ys` for longer scans
- **Rationale**: Matches user mental model. Sub-second precision is unnecessary for scan durations.
- **Alternatives considered**: ISO 8601 duration (`PT45S`) — rejected as less readable. Always seconds — rejected as `600s` is harder to parse than `10m 0s`.

## External References

- [VS Code OutputChannel API](https://code.visualstudio.com/api/references/vscode-api#OutputChannel)
- [Node.js child_process data events](https://nodejs.org/api/child_process.html#event-data)
- Constitution v1.1.0: Principles I (VS Code Native), II (Extension Host Owns State), III (Ship Fast)
