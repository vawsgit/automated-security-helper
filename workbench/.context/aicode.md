---
specs_root: docs/docs/working/
---

# Code Context

## Project
VS Code extension (`.vsix`) for the Automated Security Helper (ASH). The extension is hosted in VS Code and provides a React/TypeScript/ShadCN UI web application interface via WebView panels for security scan management, findings triage, and reporting.

## Objectives
<!-- 3-5 goals for the codebase. What are we building toward?
     Not feature-specific — these are project-level goals.

     Examples:
     - Achieve sub-100ms p95 API response times
     - Support 10,000 concurrent users
     - Maintain >90% test coverage on business logic
-->

## Architecture
<!-- High-level architecture: layers, modules, data flow.
     Describe the major components and how they connect.
     Use a Mermaid diagram if helpful.

     Examples:
     - "Three-layer architecture: API handlers > service layer > repository layer"
     - "Event-driven microservices communicating via message queue"
     - "Monolithic Next.js app with server components and API routes"
-->

## Stack
- **Language:** TypeScript (strict mode, ES2022 target)
- **Extension host:** VS Code Extension API (`@types/vscode ^1.110.0`)
- **WebView UI:** React 19, ShadCN/ui, Vite
- **Build:** `tsc` for extension, Vite for WebView
- **Test:** `@vscode/test-cli`, Mocha (extension); Vitest (WebView)
- **Lint:** ESLint flat config with `typescript-eslint`

## Patterns
- **Test-first** — write tests before or alongside implementation
- **Type-safe / strict** — strict type checking, no `any`, no implicit coercion
- **Repository pattern** — data access through repository classes, not raw queries

## Testing
<!-- Testing strategy, frameworks, coverage expectations.
     What must be tested and how.

     Examples:
     - Unit tests for all service-layer functions (Jest)
     - Integration tests for API endpoints (Supertest)
     - E2E tests for critical user flows (Playwright)
     - Minimum 80% branch coverage on business logic
     - Test files co-located: foo.ts > foo.test.ts
-->

## Key Terms
<!-- Domain-specific terms with definitions.
     Ubiquitous language for the project. Consistent naming matters.

     Examples:
     - "Workspace" — a tenant-level container; NOT "organization" or "team"
     - "Finding" — a security scan result; NOT "vulnerability" or "issue"
-->

## Constraints
<!-- What to avoid. Security boundaries, performance requirements,
     licensing restrictions, deprecated patterns.

     Examples:
     - No eval() or dynamic code execution
     - No synchronous file I/O in request handlers
     - All user input sanitized before database queries
     - No GPL-licensed dependencies
-->

## References
<!-- Links to architectural decision records, API docs, style guides,
     or any resource the AI should read before implementing features.

     - [Architecture Decision Records](path/to/adr/)
     - [API Documentation](path/to/api-docs)
     - [Style Guide](path/to/style-guide)
-->
