---
title: Overview
---

# Architecture

This section covers the structural architecture of the ASH Workbench extension: the sibling package layout, build pipeline, extension host modules, WebView application, and the message protocol that connects them.

- **[Design](./design/project-synopsis.md)** -- Design documents (functional, technical, synopsis)
- **[Extension Host](./extension-host.md)** -- vsix/ module structure, providers, commands, and data model
- **[WebView Application](./webview-application.md)** -- React/ShadCN UI, dual-context rendering, component architecture
- **[Build Pipeline](./build-pipeline.md)** -- Sibling package layout, Vite build, copy bridge, development workflow
- **[Message Protocol](./message-protocol.md)** -- Typed postMessage bridge between extension host and WebView
