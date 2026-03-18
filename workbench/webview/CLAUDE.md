# webview/

React 19 + ShadCN/ui + Tailwind CSS v4 WebView app for the ASH Workbench VS Code extension. Renders inside VS Code webview iframes (sidebar, editor panel, kitchen sink), not a standalone browser app.

- `acquireVsCodeApi()` is called once at module scope in `src/hooks/useVSCodeAPI.ts` -- no other module may call it; the app cannot run outside a VS Code webview.
- Types in `src/types/` are manual copies of `vsix/src/models/`. When changing message or data types, update both locations.
- Vite must output fixed filenames (`assets/index.js`, `assets/index.css`) -- `vsix/src/providers/webviewHtml.ts` hardcodes these paths. Do not enable content hashing.
- Domain colors (severity/disposition) use hardcoded Tailwind classes via `lib/theme-colors.ts` -- tinted pattern: `bg-{color}-500/15 text-{color}-700 dark:text-{color}-400`. Everything else inherits VS Code theme.
- All buttons use `variant="outline"` (not `default`) for subtle industrial aesthetic; active/selected states use `variant="secondary"`.
- Navigation uses `AppBreadcrumb` -- each view provides its own breadcrumb segments. Data loading on navigation requires both local `dispatch()` AND `postMessage()` to extension host.
- `@custom-variant dark (&:is(.vscode-dark *))` in `index.css` -- removing it breaks all `dark:` prefixes. `color-scheme: dark` on `.vscode-dark` -- removing it makes native input icons invisible.
- `components/ui/` files are ShadCN-generated -- do not hand-edit. Install with `npx shadcn@latest add <name> --yes` from `webview/`.

See README.md for file inventory, style conventions, ShadCN catalog, and kitchen sink guide.
