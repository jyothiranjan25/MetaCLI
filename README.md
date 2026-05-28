# ◈ MetaCLI — Persistent Cognitive Engineering Intelligence Runtime

MetaCLI is a conversation-first, terminal-native **AI Orchestration & Cognitive Reasoning Runtime** built in TypeScript and React Ink. 

Rather than calling raw provider APIs, MetaCLI orchestrates official, local AI CLI binaries (Claude Code, Gemini CLI, Codex, OpenCode) as high-performance subprocesses. It wraps them in a unified TUI dashboard adding AST-symbol semantic retrieval, multi-tier persistent memory, trusted containment sandboxes, and autonomous workflow schedulers.

---

## 🚀 Key Architectural Pillars

### 1. ⌨️ Conversation-First TUI & Command Palette
* **Interactive Conversations**: Beautiful, centered chat feed equipped with live streaming spinners and footnotes.
* **Ctrl+K Fuzzy Command Palette**: Global popup window displaying categorized commands with icons and fast arrow selection.
* **Frictionless Slash Autocomplete**: Arrow key suggestion dropdown list selection navigation (bypasses terminal command history focus collisions) and smart autocomplete on `Tab` or `Return`.
* **ESC-to-Dismiss Overlays**:
  - `/providers` — Interactive provider status setup sheet (UP/DOWN arrow navigation and Enter selection)
  - `/brain` — SQLite database scanner volumes and code indexing stats
  - `/memory` — Live querying of hot, warm, and cold SQLite memory tables
  - `/graph` — Modular codebase structure ASCII tree explorer
  - `/telemetry` — Real-time latencies distribution charts and EMA provider health scores
  - `/workflows` — Active task lists and permission whitelists
  - `/help` — Cheat-sheet cataloging command names, shortcuts, and arguments

### 2. 🧠 Persistent SQLite Project Brain & AST Retrieval
* **TypeScript Compiler API IndexIndexer**: Extracts codebase symbols, imports, interfaces, classes, and modular relationships.
* **Heuristic Regex Fallback Parser**: Extends indexing support for Python, Go, and Rust sources.
* **Incremental Scanning**: Detects workspace changes via SHA-256 hashes to skip unchanged files, executing SQLite cascade deletions.
* **Multi-tier Memory partitions**: Manages relational `hot` (chat), `warm` (milestones), and `cold` (knowledge) sqlite memory layers.
* **Cosine Similarity Retriever**: Vector cosine scoring (falling back to keyword token rankers) to compress relevant context into specialized XML prompts.

### 3. 🛡️ Trusted Sandbox containment & Isolation
* **Failsafe Path Guard**: Strict workspace boundary sandboxing with tilde expansion, credential path blocks (`~/.ssh`, `~/.aws`, `~/Library`), and nested project allowances.
* **Process Environment Sanitizer**: Sweeps all sensitive access keys and tokens from child process environment blocks.
* **Git Checkpoint Rollbacks**: Creates safety commits before executing medium/high-risk tasks and triggers hard resets on failure.
* **TUI Security Supervisor**: Dynamic visual interceptor requiring explicit keyboard approvals (`Y` to Approve, `N` to Block, `R` to Rollback) for unrecognized actions.

### 4. ↩️ Resilient In-Memory Fallbacks
* **Active Routing**: Evaluates EMA health scores and schedules specialized providers based on prompt profiles.
* **Context-Preserved Handover**: If a provider hits a rate limit (`429`) or credential failure, the engine automatically routes the **exact same context-rich PromptRequest** (containing all pre-compiled AST lines and similarity memories) to a healthy backup provider in fractions of a second without restarting from scratch.

---

## 📂 Monorepo Directory Architecture

```
MetaCLI (Monorepo)
├── apps/
│   └── cli/                ← React Ink CLI binary entry point, TUI dashboards, & Overlays
└── packages/
    ├── core/               ← Orchestration, PathGuard, EnvironmentSanitizer, and FallbackEngine
    ├── brain/              ← AST parser, sqlite brain.db, memories, and timelines
    ├── adapters/           ← Subprocess wrappers for Claude, Gemini, Codex, and OpenCode
    ├── telemetry/          ← Observability track, UsageTracker, and HealthScorer
    ├── workflow/           ← DAG graph scheduler & GitSnapshotEngine
    └── plugins/            ← Extensibility sdk with lifecycle hooks
```

---

## ⚡ Quick Start

### 1. Installation
Install the project dependencies and build the TypeScript workspace:
```bash
# Clone the repository and install packages
npm install

# Compile the entire TypeScript monorepo via Turborepo
npm run build
```

### 2. Global Installation
To run the `metacli` command globally from any directory on your system:
```bash
# Install globally on your machine from the root folder
npm install -g .

# Or link the package globally for local development
npm link --workspace metacli
```

### 3. Launch the Conversation Dashboard
You can run the interactive terminal interface in development mode via the npm workspace, or globally if installed:
```bash
# Option A: Run in development mode via npm workspace
npm run dev --workspace metacli

# Option B: Run globally from any directory (after global installation)
metacli dashboard
```

### 4. Verify and Test
```bash
# Execute all 74 unit test suites
npm run test
```

---

## ⚙️ Core CLI Commands

```bash
# 🔍 Detect installed AI CLIs and display credentials status
metacli status

# 🧠 Scan workspace files and index AST symbols to SQLite (brain.db)
metacli scan

# 🛡️ Inspect process execution security and risk audit logs
metacli audit

# ⟳ Execute an autonomous multi-agent task graph
metacli run -f metacli-tasks.json
```

---

## 🔐 Philosophy

MetaCLI does **NOT** require or use direct provider API keys. It orchestrates the official, trusted command-line clients that users have already installed and authenticated on their local machines. MetaCLI respects all official credentials databases and security sandboxes.
