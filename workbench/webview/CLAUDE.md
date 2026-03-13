# webview/

React/ShadCN WebView app for the ASH Workbench VS Code extension. Loaded inside VS Code webview iframes (sidebar and editor panel), not a standalone browser app.

- `acquireVsCodeApi()` is called at module scope in `src/hooks/useVSCodeAPI.ts` -- this function only exists inside a VS Code webview; the app cannot run in a regular browser.
- Types in `src/types/` are manual copies of `vsix/src/models/`. When changing message or data types, update both locations.
- Vite must output fixed filenames (`assets/index.js`, `assets/index.css`) -- the extension host HTML generator hardcodes these paths. Do not enable content hashing.
- `components/ui/` files are ShadCN-generated. Regenerate with `npx shadcn@latest add <name> --yes`, do not hand-edit.
- `.npmrc` sets `legacy-peer-deps=true` to resolve `@tailwindcss/vite` + Vite 8 peer conflict.
- `@` import alias resolves to `src/` (configured in `tsconfig.app.json`, `tsconfig.json`, and `vite.config.ts`).
- Docs: `docs/docs/developer-docs/architecture/webview-application.md` (dual-context rendering, theme integration, components).

See README.md for file inventory, build commands, and component reference.
