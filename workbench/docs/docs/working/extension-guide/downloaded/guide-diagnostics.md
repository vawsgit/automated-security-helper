---
title: "Extension Guide: Diagnostics"
---

# VS Code Diagnostics API Guide

> Source: https://code.visualstudio.com/api/language-extensions/programmatic-language-features

## Overview

Diagnostics indicate issues with code. VS Code displays them as squiggly underlines in editors and lists them in the Problems panel. Extensions create and manage diagnostics via `vscode.languages.createDiagnosticCollection()`.

## DiagnosticSeverity

Four levels:
- `DiagnosticSeverity.Error` (0) — Red squiggly
- `DiagnosticSeverity.Warning` (1) — Yellow squiggly
- `DiagnosticSeverity.Information` (2) — Blue squiggly
- `DiagnosticSeverity.Hint` (3) — Subtle dots

## Implementation Pattern

```typescript
let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(ctx: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('myExtension');
  ctx.subscriptions.push(diagnosticCollection);

  // Update diagnostics when documents change
  ctx.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => updateDiagnostics(doc))
  );
  ctx.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => updateDiagnostics(doc))
  );
}

function updateDiagnostics(document: vscode.TextDocument): void {
  const findings = analyzeDocument(document); // your analysis logic

  const diagnostics: vscode.Diagnostic[] = findings.map(finding => {
    const range = new vscode.Range(
      finding.line - 1, finding.startColumn,
      finding.line - 1, finding.endColumn
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      finding.message,
      finding.severity // DiagnosticSeverity.Error | Warning | Information | Hint
    );
    diagnostic.source = 'My Extension';
    diagnostic.code = finding.ruleId; // optional rule identifier
    return diagnostic;
  });

  diagnosticCollection.set(document.uri, diagnostics);
}
```

## Key Diagnostic Properties

```typescript
const diagnostic = new vscode.Diagnostic(range, message, severity);
diagnostic.source = 'Extension Name';     // Shown in Problems panel
diagnostic.code = 'RULE-001';             // Optional rule identifier
diagnostic.code = {                        // Or with a link
  value: 'RULE-001',
  target: vscode.Uri.parse('https://docs.example.com/rules/001')
};
diagnostic.relatedInformation = [          // Additional context
  new vscode.DiagnosticRelatedInformation(
    new vscode.Location(otherUri, otherRange),
    'Related issue found here'
  )
];
diagnostic.tags = [vscode.DiagnosticTag.Unnecessary]; // Fade out unused code
```

## Managing Diagnostics

```typescript
// Set diagnostics for a specific file
diagnosticCollection.set(uri, diagnostics);

// Clear diagnostics for a specific file
diagnosticCollection.delete(uri);

// Clear all diagnostics
diagnosticCollection.clear();

// Dispose when extension deactivates
diagnosticCollection.dispose();
```

## Maturity Levels

- **Basic**: Report diagnostics for open editors on document save or change
- **Advanced**: Report diagnostics across entire workspace, including unopened files

## Code Actions (Quick Fixes)

Code Actions provide corrective actions next to diagnostics. A light bulb icon appears when available.

```typescript
class MyCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    // Filter to only our diagnostics
    const myDiagnostics = context.diagnostics.filter(
      d => d.source === 'My Extension'
    );

    return myDiagnostics.map(diagnostic => {
      const fix = new vscode.CodeAction(
        `Fix: ${diagnostic.message}`,
        vscode.CodeActionKind.QuickFix
      );
      fix.diagnostics = [diagnostic];
      fix.edit = new vscode.WorkspaceEdit();
      fix.edit.replace(document.uri, diagnostic.range, 'corrected code');
      return fix;
    });
  }
}

// Register in activate()
context.subscriptions.push(
  vscode.languages.registerCodeActionsProvider(
    { scheme: 'file' },
    new MyCodeActionProvider()
  )
);
```

### package.json for Code Actions

```json
{
  "contributes": {
    "languages": [
      { "id": "myLanguage" }
    ]
  }
}
```

No special contribution point needed for diagnostics — they are purely programmatic.
