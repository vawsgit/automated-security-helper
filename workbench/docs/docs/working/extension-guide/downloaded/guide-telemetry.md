---
title: "Extension Guide: Telemetry"
---

# VS Code Telemetry Guide

> Source: https://code.visualstudio.com/api/extension-guides/telemetry

## Key Principles

VS Code collects usage data to improve products and services. Users can disable telemetry via the `telemetry.telemetryLevel` setting. Extension authors must respect user preferences through centralized controls.

## Recommended Telemetry Module

The VS Code team maintains the `@vscode/extension-telemetry` npm package, providing a consistent and safe way to collect telemetry. It integrates with Azure Monitor and Application Insights while ensuring backward compatibility.

## Alternative Approaches

Extension authors not using Application Insights must still honor user choices by implementing:

```typescript
// Check if telemetry is enabled
const enabled = vscode.env.isTelemetryEnabled;

// Listen for changes
vscode.env.onDidChangeTelemetryEnabled(enabled => {
  // Update telemetry state
});
```

## Custom Settings

Extensions may create custom telemetry settings by tagging them with `telemetry` and `usesOnlineServices`:

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "myExtension.enableTelemetry": {
          "type": "boolean",
          "default": true,
          "tags": ["telemetry", "usesOnlineServices"]
        }
      }
    }
  }
}
```

Custom settings cannot override user's overall telemetry preference.

## Transparency: telemetry.json

Extensions may include `telemetry.json` files enabling users to review collected data via the CLI `--telemetry` flag.

## Best Practices

**Do:**
- Use the official `@vscode/extension-telemetry` module
- Respect user consent APIs
- Minimize data collection
- Prioritize transparency

**Don't:**
- Implement custom solutions without consent
- Collect personally identifiable information
- Gather excessive data
- Rely solely on `telemetry.telemetryLevel` setting
