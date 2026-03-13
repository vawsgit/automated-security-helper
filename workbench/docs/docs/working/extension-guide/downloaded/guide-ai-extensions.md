---
title: "Extension Guide: AI Extensions (Chat Participants)"
---

# VS Code Chat Participant API Guide

> Source: https://code.visualstudio.com/api/extension-guides/chat

## Overview

The Chat Participant API provides comprehensive guidance for building chat participants as VS Code extensions. Chat participants are specialized assistants invoked via `@` mentions that handle natural language prompts with domain-specific expertise.

## Core Implementation Steps

### 1. Register the Participant in `package.json`

Register with the following properties:
- `id` — Unique identifier
- `name` — Lowercase invocation name
- `fullName` — Title case display name
- `description` — Brief description of capabilities
- `isSticky` — Whether the participant stays selected

### 2. Implement a ChatRequestHandler

Process user requests via the Chat Participant API. The handler receives the user's prompt and produces responses.

### 3. Define Slash Commands

Slash commands (`/`) serve as shortcuts for common tasks within the participant's scope.

### 4. Configure Follow-up Suggestions

Use `ChatFollowupProvider` to suggest next steps after a response.

### 5. Enable Automatic Participant Detection

Through disambiguation categories, VS Code can automatically route queries to the appropriate participant.

## Chat Response Types Supported

- **Markdown text and images** — Rich formatted responses
- **Code blocks with IntelliSense** — Syntax-highlighted code
- **Command links and buttons** — Interactive UI elements
- **File tree controls** — Navigate file structures
- **Progress messages** — Long-running operation feedback
- **References (files/URLs)** — Link to relevant resources
- **Inline anchors** — Deep links within responses

## Tool Calling

Extensions can invoke language model tools either via the `@vscode/chat-extension-utils` library or by implementing tool calling directly for greater control.

## Telemetry & Success Metrics

Track participant effectiveness using feedback events:
```
unhelpful_feedback_count / total_requests
```

## Key Guidelines

- Don't create purely question-answering bots; leverage VS Code APIs for rich integrations
- Limit one chat participant per extension for better UX
- Require explicit user consent for costly operations
- Follow naming conventions: lowercase for `name`, title case for `fullName`
- Request user feedback to measure AI feature quality

The guide emphasizes building intelligent, context-aware participants that deeply integrate with VS Code's ecosystem rather than generic conversational interfaces.
