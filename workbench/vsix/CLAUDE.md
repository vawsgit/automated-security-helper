# vsix/

VS Code extension host for ASH Workbench — spawns the ASH CLI, persists results in PGLite, and communicates with the React webview via typed `postMessage`.

- Database is PGLite (WASM Postgres) with Prisma ORM. Migrations are raw SQL in `prisma/migrations/`, applied via custom runner in `DatabaseService` (not the Prisma CLI). Migration tracking table is `_ash_migrations`.
- `models/messages.ts` and `webview/src/types/messages.ts` must be **manually kept in sync** — same for `models/types.ts` and `webview/src/types/types.ts`.
- `ScannerService` reads `ashWorkbench.*` settings via `vscode.workspace.getConfiguration('ashWorkbench')` — test code uses `setConfigOverride()` to avoid the VS Code API.
- `FindingsPanelManager.currentScanId` is an instance variable (not a closure parameter) — the `handleMessage` listener is registered once and reads `this.currentScanId` on every call.
- `webviewHtml.ts` hardcodes asset paths `webview-dist/assets/index.js` and `index.css` — Vite output filenames must stay fixed.
- Kitchen Sink command (`ashWorkbench.openKitchenSink`) is only registered when `extensionMode === Development`.

See README.md for file inventory, commands, settings, and message protocol.
