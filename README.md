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

### 5. 🧠 Sovereign Cognitive Engineering Intelligence Layer (17 Subsystems)
MetaCLI incorporates an active cognitive layer (fully tested in `packages/brain/src/cognitive/cognitive.test.ts`) that transforms raw AI execution into an adaptive engineering intelligence runtime:
* **Developer DNA Profile (`DeveloperDNAEngine`)**: Learns stylistic styling rules, spacing, and casing from edits to adapt formatting.
* **Temporal Engineering Analytics (`TemporalEngineeringAnalyzer`)**: Forecasts modular codebase complexity trends and drift velocities.
* **Blast Radius Simulation (`RepositorySimulationEngine`)**: Calculates potential risk maps and dependency impacts before changes.
* **Engineering State Tracking (`EngineeringStateAnalyzer`)**: Gauges developer mood/flow states from event metrics to dynamically scale prompts.
* **Architectural Proposal Guard (`RefactorSafetyEngine`)**: Scores refactoring safety factors and warns on risky or destructive plans.
* **Dependency Decay & Threat Detection (`ThreatDetectionEngine`)**: Highlights circular references, unstable couplings, and code smell patterns.
* **Milestone Narrator (`ProjectNarrativeEngine`)**: Translates chronological epochs into descriptive, human-readable codebase evolution logs.
* **Semantic Hybrid Search (`SemanticRepositorySearchEngine`)**: Employs query-intent parsing to blend structural keyword rankings with AST similarity.
* **Architectural Intent Capture (`EngineeringReasoningEngine`)**: Stores commit reasoning ("WHY" a file changed, not just "WHAT" changed) in SQLite.
* **Self-Decaying Memories (`SelfCuratingBrainEngine`)**: Reduces confidence coefficients of stale knowledge bases as code changes over time.
* **Living Documentation Compiler (`KnowledgeDistillationEngine`)**: Dynamically summarizes full-module AST architectures into readable Markdown specs.
* **Distributed State Sync (`DistributedSynchronizationEngine`)**: Reconciles local memory database deltas seamlessly across remote team machines.
* **Long-Term Roadmap Director (`StrategicProjectUnderstandingEngine`)**: Extracts macroeconomic themes to propose architecture evolution directives.
* **Visual Graph Engine (`ArchitectureGraphRuntime`)**: Feeds active symbol dependency traversals to `/graph` ASCII viewport maps.
* **Cascading Session Compactor (`HierarchicalCompressionEngine`)**: Condenses long chat feeds into multi-tier session summaries to save tokens.
* **Crash & Failure Learner (`FailureLearningEngine`)**: Records stack traces and revert histories to formulate compile-time safety rules.
* **Topological Snapshot Diff (`ArchitectureSnapshotEngine`)**: Computes structural AST changes between major codebase milestones.

### 6. ⚡ Autonomous Intelligence Orchestration & Refinement (Core Subsystems)
MetaCLI glues the entire environment together inside a highly performant, E2E coordinated operating loop (fully tested in `packages/core/src/cognitive/cognitive.test.ts`):
* **Context Budget Intelligence (`ContextBudgetEngine`)**: Allocates exact slice sizes and trims low-value blocks to strictly respect provider limits.
* **Semantic Context Prioritizer (`SemanticContextPrioritizer`)**: Employs TypeScript compiler import structures to rank highly coupled AST interfaces above flat keyword query similarities.
* **Intent-Aware Retrieval (`IntentAwareRetrievalOrchestrator`)**: Switches search strategies dynamically depending on refactoring, debugging, planning, or auditing intents.
* **Adaptive Routing (`AdaptiveOrchestrationEngine`)**: Evaluates task complexities and past provider health records to adapt routing parameters.
* **Conversational Continuity (`ConversationContinuityEngine`)**: Persists chronological epoch boundaries to restore workspace states across CLI sessions.
* **Engineering Confidence (`EngineeringConfidenceEngine`)**: Scores operational reliability based on memory freshness and active provider EMA degradations.
* **Runtime Presence Footnotes (`RuntimePresenceEngine`)**: Emits subtle visual footnotes (`Context optimized | AST DB Warmed`) in the TUI input footer.
* **Autonomous Health Monitor (`RuntimeHealthEngine`)**: Scans operational latencies and SQLite index drifts to execute self-healing steps.
* **Cognitive Event Observability (`EventBus`)**: Incorporates typed history ring buffers (last 200 events) for full cognitive replay timelines diagnostics.

---

## 📂 Monorepo Directory Architecture

```
MetaCLI (Monorepo)
├── apps/
│   └── cli/                ← React Ink CLI binary entry point, TUI dashboards, & Overlays
└── packages/
    ├── core/               ← Orchestration, PathGuard, EnvironmentSanitizer, and FallbackEngine
    │   └── src/
    │       ├── cognitive/
    │       │   ├── presence/   ← RuntimePresenceEngine.ts (TUI statuses and greeting footnotes)
    │       │   └── state/      ← EngineeringConfidenceEngine.ts (caution safety index evaluator)
    │       ├── orchestrator/   ← ContextBudgetEngine.ts, SemanticContextPrioritizer.ts,
    │       │                     IntentAwareRetrievalOrchestrator.ts, AdaptiveOrchestrationEngine.ts
    │       ├── session/        ← ConversationContinuityEngine.ts (cross-session continuity stitches)
    │       ├── runtime/        ← RuntimeHealthEngine.ts (auto health recovery diagnostics)
    │       └── events/         ← EventBus.ts (observability ring buffers timeline)
    ├── brain/              ← AST parser, sqlite brain.db, memories, timelines & cognitive engines
    │   └── src/cognitive/  ← 🧠 Sovereign Cognitive Engineering Intelligence Layer (17 Subsystems)
    │       ├── adaptation/  ← Developer DNA stylistic preference learning (DeveloperDNAEngine.ts)
    │       ├── analytics/   ← Codebase complexity drift analytics (TemporalEngineeringAnalyzer.ts)
    │       ├── distillation/← AST to Markdown living document compilers (KnowledgeDistillationEngine.ts)
    │       ├── distributed/ ← Multi-machine SQLite memory synchronization (DistributedSynchronizationEngine.ts)
    │       ├── learning/    ← Failure crash constraints & defensive rules (FailureLearningEngine.ts)
    │       ├── memory/      ← Curated, compressed memories & snapshots (SelfCuratingBrainEngine.ts, etc.)
    │       ├── narrative/   ← Historical epic milestones & strategic roadmaps (ProjectNarrativeEngine.ts)
    │       ├── reasoning/   ← Multi-intent commit rationale recorders (EngineeringReasoningEngine.ts)
    │       ├── refactor/    ← Proposal safety assessments & rules evaluators (RefactorSafetyEngine.ts)
    │       ├── search/      ← Hybrid semantic and token rank query parsers (SemanticRepositorySearchEngine.ts)
    │       ├── simulation/  ← Blast-radius change impact simulators (RepositorySimulationEngine.ts)
    │       ├── state/       ← Session state/developer flow monitors (EngineeringStateAnalyzer.ts)
    │       ├── threat/      ← Circular dependency & unstable coupling inspectors (ThreatDetectionEngine.ts)
    │       └── visualization/← Active topological view viewport partitioners (ArchitectureGraphRuntime.ts)
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
