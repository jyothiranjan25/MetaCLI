# MetaCLI

Unified orchestration CLI for AI coding CLIs.

MetaCLI orchestrates official installed AI CLIs (Claude Code, Gemini CLI, Aider, etc.) as subprocesses — adding unified routing, memory, workflows, and terminal UX on top.

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the CLI
pnpm --filter @metacli/cli dev
```

## Architecture

- `apps/cli` — Main CLI entry point (Ink terminal UI)
- `packages/core` — Orchestration, routing, fallback, events
- `packages/adapters` — Provider adapter system (Claude, Gemini, Aider, etc.)
- `packages/brain` — Memory system, code intelligence, retrieval
- `packages/telemetry` — Usage tracking, health scoring
- `packages/workflow` — DAG-based workflow engine
- `packages/plugins` — Plugin runtime and API

## Philosophy

MetaCLI does NOT use provider APIs directly. It orchestrates official CLI tools that users install and authenticate normally. MetaCLI respects all official authentication systems and never touches tokens or credentials.
