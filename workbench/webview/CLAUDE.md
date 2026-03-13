# webview/

React 19 + ShadCN/ui + Tailwind CSS v4 WebView app for the ASH Workbench VS Code extension. Renders inside VS Code webview iframes (sidebar, editor panel, kitchen sink), not a standalone browser app.

- `acquireVsCodeApi()` is called at module scope in `src/hooks/useVSCodeAPI.ts` -- this function only exists inside a VS Code webview; the app cannot run in a regular browser.
- Types in `src/types/` are manual copies of `vsix/src/models/`. When changing message or data types, update both locations.
- Vite must output fixed filenames (`assets/index.js`, `assets/index.css`) -- the extension host HTML generator hardcodes these paths. Do not enable content hashing.
- `components/ui/` files are ShadCN-generated -- do not hand-edit. Use ShadCN MCP tools (`mcp__shadcn__view_items_in_registries`, `mcp__shadcn__get_item_examples_from_registries`) to inspect APIs and pull official examples, then install with `npx shadcn@latest add <name> --yes`.
- Kitchen Sink (`pages/sink/`) is the living component reference -- add a demo file + registry entry for every new UI component. Open via `ASH: Open Kitchen Sink` command (dev builds only).
- `.npmrc` sets `legacy-peer-deps=true` to resolve `@tailwindcss/vite` + Vite 8 peer conflict.
- `@` import alias resolves to `src/` (configured in `tsconfig.app.json`, `tsconfig.json`, and `vite.config.ts`).
- Docs: `docs/docs/developer-docs/architecture/webview-application.md` (dual-context rendering, theme integration, components).

See README.md for file inventory, ShadCN component catalog, kitchen sink guide, and build commands.
