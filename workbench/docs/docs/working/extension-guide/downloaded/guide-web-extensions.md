---
title: "Extension Guide: Web Extensions"
---

# VS Code Web Extensions Guide

> Source: https://code.visualstudio.com/api/extension-guides/web-extensions

## Overview

VS Code supports running as a browser-based editor, enabling extensions to execute in a "web extension host" environment. Web extensions operate within a WebWorker sandbox rather than Node.js.

## Key Architectural Differences

- Cannot import external modules via `importScripts`
- Must be packaged as single files (bundled)
- Cannot access Node.js APIs like `process`, `os`, or `path` directly
- The VS Code API can be loaded via `require('vscode')` through a provided shim

## Extension Manifest Structure

Web extensions use a `browser` property instead of `main` in package.json:

```json
{
  "browser": "./dist/web/extension.js",
  "scripts": {
    "compile-web": "webpack",
    "watch-web": "webpack --watch",
    "package-web": "webpack --mode production --devtool hidden-source-map"
  }
}
```

## File System Limitations

Workspace files require the virtual file system API. Storage locations (`extensionUri`, `storageUri`, `globalStorageUri`) similarly require `vscode.workspace.fs`.

## Development Workflow

### Scaffolding

Use `yo code` and select "New Web Extension" to generate a project with webpack or esbuild configuration.

### Build Configuration (webpack)

- **Target**: `webworker`
- **Resolution**: Browser-first module resolution with fallbacks for Node core modules
- **Plugins**: ProvidePlugin to polyfill globals like `process`
- **External**: `vscode` marked as external

### Testing Approaches

1. **Desktop VS Code**: `--extensionDevelopmentKind=web` flag with `pwa-extensionHost` launch configuration
2. **@vscode/test-web**: Browser-based testing via local server on localhost:3000
3. **vscode.dev Sideloading**: Direct testing in production environment after hosting locally with HTTPS

## Language Server Protocol Support

`vscode-languageserver-node` provides a browser implementation since 3.16.0 allowing language servers to run in WebWorkers with postMessage-based connections:
- Client: import from `vscode-languageclient/browser`
- Server: import from `vscode-languageserver/browser`

## Migrating Existing Extensions

1. Create webpack configuration targeting WebWorker
2. Add `browser` property to package.json
3. Replace Node.js APIs with browser equivalents or polyfills
4. Use `vscode-uri` module for path operations instead of `path`
5. Replace `fs` module with `vscode.workspace.fs`

## WebAssembly Support

The browser runtime supports JavaScript and WebAssembly. Libraries can be cross-compiled using Emscripten (C/C++) or wasm-pack (Rust).

## Automatic Web Extension Detection

VS Code treats extensions as web extensions when they have a `browser` entry point OR contain only declarative contributions without `main`.

## Publishing

Use current `vsce` tooling, which automatically tags extensions meeting web extension criteria.
