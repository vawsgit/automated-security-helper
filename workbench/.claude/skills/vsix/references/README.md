# VSIX Skill References

## VS Code API Documentation

These files contain VS Code extension API patterns and UX conventions compiled from official documentation:

- **Cheat sheet** (quick reference, ~330 lines): `docs/docs/working/extension-guide/vscode-extension-cheat-sheet.md`
- **Full reference** (comprehensive, ~1,050 lines): `docs/docs/developer-docs/reference/vscode-extension-reference.md`
- **Downloaded source docs** (raw, per-topic): `docs/docs/working/extension-guide/downloaded/`

## Design Specifications

- **Functional design** (what the app does): `docs/docs/developer-docs/architecture/design/functional-design.md`
- **Technical design** (how it's built): `docs/docs/developer-docs/architecture/design/technical-design.md`
- **Project synopsis** (quick overview): `docs/docs/developer-docs/architecture/design/project-synopsis.md`

## When to Read What

| Task | Read |
|------|------|
| Adding a VS Code UI element (command, view, status bar, etc.) | Cheat sheet first, full reference if more detail needed |
| Implementing a new feature end-to-end | Functional design (user story) + technical design (architecture) |
| Understanding the data model or message protocol | Technical design, sections 3-6 |
| Understanding ASH CLI integration | Technical design, section 5 |
| UX decisions (what to use, what to avoid) | Full reference (UX rules embedded per section) |
