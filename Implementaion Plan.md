# MetaCLI — Full Architecture, Research & Implementation Plan

## Executive Summary

MetaCLI is a **subprocess orchestration platform** for AI coding CLIs. It does NOT call provider APIs directly. Instead, it spawns, monitors, and routes work through officially installed and authenticated CLI tools (Claude Code, Gemini CLI, Aider, etc.), adding a unified memory layer, workflow engine, and terminal UX on top.

Think: **Docker Compose for AI coding agents** — each provider remains sovereign; MetaCLI orchestrates the ensemble.

---

## Part 1: Deep Research Findings

### 1.1 AI CLI Subprocess Feasibility Matrix

The following table summarizes live research on each CLI's orchestration readiness. This is the **single most critical input** to the architecture — if a CLI can't be driven as a subprocess, MetaCLI can't orchestrate it.

| CLI | Auth Model | Non-Interactive Flag | JSON Output | PTY Required? | Subprocess Feasibility | Config Location |
|:----|:-----------|:---------------------|:------------|:--------------|:-----------------------|:----------------|
| **Claude Code** | OAuth browser + API key + Cloud IAM | `-p` (prompt mode) | `--output-format json`, `stream-json` | No (pipe-friendly in `-p` mode) | **Excellent** — designed for subprocess use, stream-json stdin/stdout protocol | `~/.claude/.credentials.json`, macOS Keychain |
| **Gemini CLI** | Google OAuth browser + API key + Service Account | `-p` (prompt mode) | `--output-format json`, `stream-json` | No in `-p` mode | **Excellent** — mirrors Claude Code's subprocess model | `~/.gemini/`, `~/.gemini/settings.json` |
| **Aider** | Env vars only (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) | `--message`, `--yes-always`, `--no-stream` | No native JSON mode (text output) | **No** — works without PTY | **Good** — clean non-interactive mode, but output is unstructured text |
| **Codex CLI** | `OPENAI_API_KEY` env var | `-p` prompt mode | Structured streaming (SSE) | No | **Good** — standard OpenAI subprocess patterns |
| **Cline** | API keys via `cline auth`, supports OAuth | Headless mode via CLI | JSON streaming | No | **Good** — shared Agent Core between CLI/VSCode |
| **Continue.dev** | `CONTINUE_API_KEY` env var | `-p` prompt, `--auto` | stdout text | No | **Good** — designed for CI/CD |
| **OpenCode** | Env vars (`ANTHROPIC_API_KEY`, etc.) | `opencode run` headless mode | Text output | No (Go-based TUI) | **Moderate** — headless mode exists but limited JSON |
| **Goose** | Pre-configured `~/.config/goose/config.yaml` + env vars | `goose run --text`, `GOOSE_MODE=auto` | `--output-format json` | No (`stdin=DEVNULL` recommended) | **Good** — explicit headless design, JSON output |
| **Open Interpreter** | Env vars | `-y --json` | JSON/JSONL stream | No | **Good** — clean automation flags |
| **llm (Willison)** | `llm keys set` + stored keys | Pipe-based (Unix philosophy) | Text (SQLite logging) | No | **Excellent** — designed for Unix piping |
| **Cody (Sourcegraph)** | PAT via env vars (`SRC_ACCESS_TOKEN`) | `@sourcegraph/cody-agent` JSON-RPC | JSON-RPC over stdin/stdout | No | **Enterprise only** — requires Sourcegraph Enterprise |
| **Cursor Agent** | `CURSOR_API_KEY` env var | `-p` non-interactive | JSON output available | No | **Moderate** — relatively new CLI surface |
| **Warp AI** | Warp account (proprietary) | `warp agent task` | Block-based output | Warp terminal required | **Poor** — tightly coupled to Warp terminal |

### 1.2 Critical Authentication Research Findings

> [!IMPORTANT]
> **Login-based CLIs (OAuth) that work as subprocesses**: Claude Code and Gemini CLI are the two primary CLIs that support both OAuth browser login AND subprocess orchestration. They persist credentials locally and child processes inherit the authenticated session.

**How OAuth session reuse works in practice:**

1. User runs `claude login` or `gemini` interactively once
2. Credentials are stored locally (`~/.claude/.credentials.json`, `~/.gemini/`)
3. MetaCLI spawns the CLI as a subprocess — it inherits the user's HOME directory
4. The subprocess finds cached credentials and authenticates automatically
5. Token refresh is handled by the CLI internally — MetaCLI is transparent to this

**Key insight**: MetaCLI does NOT need to touch, read, or manage any credentials. It simply needs to:
- Ensure `HOME` / `XDG_CONFIG_HOME` environment variables are inherited
- Spawn the subprocess with the correct user environment
- Detect auth failures via exit codes or error output

### 1.3 Rate Limit & Cooldown Research

| Provider | Limit Model | Detection Method | Cooldown |
|:---------|:------------|:----------------|:---------|
| **Claude Code (subscription)** | 5-hour rolling window, weekly compute cap | CLI outputs "limit reached" + reset timestamp | 5-hour window reset |
| **Claude Code (API key)** | RPM/TPM per API tier | HTTP 429 in JSON output | Exponential backoff |
| **Gemini CLI (free)** | 5-15 RPM depending on model | HTTP 429 `Resource Exhausted` | Backoff with jitter |
| **Gemini CLI (paid)** | Project-level quota | `/stats` command, 429 errors | Tiered limits |
| **Aider** | Depends on underlying provider | Provider error messages in output | Passthrough |

**MetaCLI's rate limit strategy**:
- Parse subprocess output for rate limit signals (429 errors, "limit reached" messages)
- Maintain per-provider cooldown timers
- Use health scoring (exponential moving average of success/failure)
- Trigger automatic fallback routing when a provider enters cooldown

### 1.4 Terminal Orchestration Research

#### node-pty vs execa — The Critical Decision

| Aspect | node-pty | execa |
|:-------|:---------|:------|
| **Purpose** | PTY emulation — child thinks it's in a terminal | Process execution — clean pipe-based I/O |
| **When needed** | Interactive CLIs that require TTY detection | Non-interactive/headless subprocess execution |
| **ANSI handling** | Full ANSI passthrough (colors, cursor) | Clean stdout, no ANSI unless forced |
| **Complexity** | High (native addon, cleanup, signal handling) | Low (pure JS, Promise-based) |
| **Cross-platform** | Requires native compilation per platform | Pure JS, works everywhere |

> [!IMPORTANT]
> **Architecture Decision: Use execa as the primary subprocess driver, with node-pty as an optional fallback for CLIs that absolutely require TTY.**
>
> Since Claude Code, Gemini CLI, Aider, and all major CLIs support non-interactive modes with clean pipe I/O, execa is the correct default. Using node-pty universally would introduce unnecessary native addon complexity and ANSI parsing overhead.

**ANSI handling strategy for PTY fallback mode:**
- Set `NO_COLOR=1` or `TERM=dumb` environment variable
- Use regex stripping: `\x1b\[[0-9;]*[a-zA-Z]`
- Parse structured JSON output where available (preferred)

#### Terminal UI Framework — Ink

**Decision: Ink (React for terminals)** is the correct choice for MetaCLI's UI layer.

Rationale:
- Used by Claude Code, Gemini CLI, and GitHub Copilot CLI — industry standard
- React component model enables complex, composable UI
- Yoga/Flexbox layout for sophisticated terminal layouts
- Excellent streaming data handling via React state
- Massive ecosystem of hooks and components
- **blessed** is unmaintained — reject
- **terminal-kit** is too low-level for the UX ambitions of this project

### 1.5 Memory & Code Intelligence Research

#### Vector Database — LanceDB

**Decision: LanceDB** for MetaCLI's semantic memory layer.

| Criteria | LanceDB | ChromaDB | sqlite-vec |
|:---------|:--------|:---------|:-----------|
| **Architecture** | Embedded (Rust/Arrow), serverless | Client-server or embedded | SQLite extension |
| **TypeScript support** | First-class | Good | Raw SQL |
| **Scalability** | Billions of vectors on disk | Good for prototypes | Limited |
| **Multimodal** | Yes (text + embeddings in same store) | Text-focused | Vectors only |
| **Install complexity** | npm install (Rust compiled) | Requires Python server or WASM | C extension |
| **Production readiness** | High | Moderate | Moderate |

#### Code Parsing — tree-sitter

**Decision: tree-sitter** for AST-based code intelligence.

- Incremental parsing (microsecond updates on file changes)
- Error-tolerant (works on incomplete/invalid code)
- No build system config required (no tsconfig.json dependency)
- Language-agnostic query system (S-expressions)
- Industry standard for IDE tooling and code intelligence

#### Local Embeddings — Transformers.js

**Decision: Transformers.js v4** with quantized ONNX models for local embedding generation.

- Runs 100% locally in Node.js — no API calls for embeddings
- WebGPU acceleration available
- Quantized models (q8) for efficiency
- Code-optimized models available (BGE-M3, Nomic Embed)
- Zero privacy concerns — embeddings never leave the machine

---

## Part 2: Architecture Design

### 2.1 Monorepo Structure

```
metacli/
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json                    # Solution-style root config
├── package.json
│
├── apps/
│   └── cli/                         # @metacli/cli — main entry point
│       ├── package.json
│       ├── src/
│       │   ├── index.ts             # CLI entry, command routing
│       │   ├── commands/            # ask, workflow, status, config, scan
│       │   └── ui/                  # Ink components
│       │       ├── App.tsx
│       │       ├── StreamingOutput.tsx
│       │       ├── ProviderStatus.tsx
│       │       ├── WorkflowProgress.tsx
│       │       └── Dashboard.tsx
│       └── tsconfig.json
│
├── packages/
│   ├── core/                        # @metacli/core — domain logic
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── orchestrator/        # Main orchestration loop
│   │   │   │   ├── Orchestrator.ts
│   │   │   │   ├── ProviderRouter.ts
│   │   │   │   └── FallbackEngine.ts
│   │   │   ├── session/             # Session lifecycle
│   │   │   │   ├── SessionManager.ts
│   │   │   │   └── SessionCompactor.ts
│   │   │   ├── config/              # Configuration management
│   │   │   │   ├── ConfigLoader.ts
│   │   │   │   └── schema.ts
│   │   │   └── events/              # Event bus
│   │   │       ├── EventBus.ts
│   │   │       └── events.ts
│   │   └── tsconfig.json
│   │
│   ├── adapters/                    # @metacli/adapters — provider adapters
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── types.ts             # AIAdapter interface
│   │   │   ├── base/
│   │   │   │   ├── SubprocessAdapter.ts     # Base execa adapter
│   │   │   │   └── PtyAdapter.ts            # Base node-pty adapter
│   │   │   ├── claude/
│   │   │   │   ├── ClaudeAdapter.ts
│   │   │   │   ├── ClaudeDetector.ts
│   │   │   │   └── ClaudeOutputParser.ts
│   │   │   ├── gemini/
│   │   │   │   ├── GeminiAdapter.ts
│   │   │   │   ├── GeminiDetector.ts
│   │   │   │   └── GeminiOutputParser.ts
│   │   │   ├── aider/
│   │   │   │   ├── AiderAdapter.ts
│   │   │   │   └── AiderOutputParser.ts
│   │   │   ├── codex/
│   │   │   ├── cline/
│   │   │   ├── goose/
│   │   │   ├── openinterpreter/
│   │   │   └── llm/
│   │   └── tsconfig.json
│   │
│   ├── brain/                       # @metacli/brain — memory & intelligence
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── memory/
│   │   │   │   ├── MemoryManager.ts         # Unified memory orchestrator
│   │   │   │   ├── HotMemory.ts             # Current active context
│   │   │   │   ├── WarmMemory.ts            # Recent session summaries
│   │   │   │   ├── ColdMemory.ts            # Compressed long-term memory
│   │   │   │   └── SemanticMemory.ts        # Vector-based retrieval
│   │   │   ├── indexing/
│   │   │   │   ├── IndexOrchestrator.ts     # Coordinates all indexers
│   │   │   │   ├── FileIndexer.ts           # File metadata & purpose
│   │   │   │   ├── SymbolIndexer.ts         # Functions, classes, exports
│   │   │   │   ├── DependencyGrapher.ts     # Import/module relationships
│   │   │   │   ├── ArchitectureInferrer.ts  # Framework/pattern detection
│   │   │   │   └── EmbeddingGenerator.ts    # Local embedding via Transformers.js
│   │   │   ├── knowledge-graph/
│   │   │   │   ├── KnowledgeGraph.ts        # Entity-relation graph
│   │   │   │   ├── entities.ts              # Node types
│   │   │   │   └── relations.ts             # Edge types
│   │   │   ├── retrieval/
│   │   │   │   ├── RetrievalEngine.ts       # Unified retrieval interface
│   │   │   │   ├── VectorRetriever.ts       # Semantic search via LanceDB
│   │   │   │   ├── GraphRetriever.ts        # Graph traversal retrieval
│   │   │   │   └── HybridRetriever.ts       # Vector + keyword (BM25) fusion
│   │   │   ├── compaction/
│   │   │   │   ├── SessionCompactor.ts      # Session summarization
│   │   │   │   └── MemoryCompressor.ts      # Hierarchical compression
│   │   │   └── persistence/
│   │   │       ├── BrainStore.ts            # SQLite persistence layer
│   │   │       └── VectorStore.ts           # LanceDB wrapper
│   │   └── tsconfig.json
│   │
│   ├── workflow/                    # @metacli/workflow — DAG execution engine
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── WorkflowEngine.ts
│   │   │   ├── DAGExecutor.ts
│   │   │   ├── TaskNode.ts
│   │   │   ├── WorkflowParser.ts    # YAML workflow config parser
│   │   │   └── templates/           # Built-in workflow templates
│   │   │       ├── plan-code-review.yaml
│   │   │       └── multi-agent-debug.yaml
│   │   └── tsconfig.json
│   │
│   ├── telemetry/                   # @metacli/telemetry — usage tracking
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── UsageTracker.ts
│   │   │   ├── HealthScorer.ts
│   │   │   ├── CooldownManager.ts
│   │   │   └── TelemetryStore.ts    # SQLite usage log
│   │   └── tsconfig.json
│   │
│   ├── tmux/                        # @metacli/tmux — tmux integration
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── TmuxController.ts
│   │   │   ├── PaneManager.ts
│   │   │   └── LayoutBuilder.ts
│   │   └── tsconfig.json
│   │
│   └── plugins/                     # @metacli/plugins — plugin runtime
│       ├── package.json
│       ├── src/
│       │   ├── PluginManager.ts
│       │   ├── PluginLoader.ts
│       │   ├── PluginAPI.ts         # Public API for plugin authors
│       │   └── types.ts             # Plugin interface contracts
│       └── tsconfig.json
│
└── plugins/                         # Built-in first-party plugins
    ├── plugin-git/
    ├── plugin-github/
    └── plugin-jira/
```

### 2.2 Core Interface Contracts

#### AIAdapter Interface — The Central Abstraction

```typescript
// packages/adapters/src/types.ts

export interface AIAdapter {
  readonly id: string;                           // e.g. "claude-code"
  readonly displayName: string;                  // e.g. "Claude Code"
  readonly capabilities: AdapterCapabilities;

  // Lifecycle
  detect(): Promise<DetectionResult>;            // Is CLI installed? Which version?
  checkAuth(): Promise<AuthStatus>;              // Is session valid?
  checkHealth(): Promise<HealthStatus>;          // Is provider responsive?

  // Execution
  sendPrompt(request: PromptRequest): AsyncGenerator<StreamEvent>;
  abort(): Promise<void>;

  // Introspection
  getUsageEstimate(): Promise<UsageEstimate>;
  getRateLimitStatus(): Promise<RateLimitStatus>;
}

export interface AdapterCapabilities {
  supportsStreaming: boolean;
  supportsJsonOutput: boolean;
  supportsNonInteractive: boolean;
  supportsFileContext: boolean;
  requiresPty: boolean;
  authType: 'oauth' | 'api-key' | 'config-file' | 'mixed';
}

export interface DetectionResult {
  installed: boolean;
  binaryPath?: string;
  version?: string;
  configDir?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  method?: 'oauth' | 'api-key' | 'service-account';
  expiresAt?: Date;
  error?: string;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  rateLimited: boolean;
  cooldownUntil?: Date;
  score: number;                    // 0-100, exponential moving average
}

export interface PromptRequest {
  prompt: string;
  systemPrompt?: string;
  files?: string[];                 // File paths to include as context
  workingDirectory: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; tool: string; input: unknown }
  | { type: 'tool_result'; result: unknown }
  | { type: 'error'; error: string; code?: string }
  | { type: 'rate_limit'; retryAfter?: number }
  | { type: 'done'; usage?: UsageEstimate };

export interface UsageEstimate {
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  remainingQuota?: number;
  windowResetAt?: Date;
}
```

#### Memory System Interfaces

```typescript
// packages/brain/src/memory/types.ts

export interface MemoryLayer {
  readonly tier: 'hot' | 'warm' | 'cold' | 'semantic';
  store(entry: MemoryEntry): Promise<void>;
  retrieve(query: RetrievalQuery): Promise<MemoryEntry[]>;
  compact(): Promise<CompactionResult>;
}

export interface MemoryEntry {
  id: string;
  tier: 'hot' | 'warm' | 'cold' | 'semantic';
  content: string;
  metadata: EntryMetadata;
  embedding?: Float32Array;
  createdAt: Date;
  accessedAt: Date;
  relevanceScore?: number;
}

export interface RetrievalQuery {
  query: string;
  maxResults: number;
  tiers?: Array<'hot' | 'warm' | 'cold' | 'semantic'>;
  filters?: {
    filePatterns?: string[];
    symbolTypes?: string[];
    timeRange?: { from: Date; to: Date };
    minRelevance?: number;
  };
}

export interface ProjectBrain {
  // Scanning
  scan(options?: ScanOptions): AsyncGenerator<ScanProgress>;
  incrementalUpdate(changedFiles: string[]): Promise<UpdateResult>;

  // Retrieval
  getRelevantContext(prompt: string): Promise<ContextBundle>;
  getArchitectureSummary(): Promise<string>;
  getFileContext(filePath: string): Promise<FileContext>;
  getSymbol(symbolName: string): Promise<SymbolInfo | null>;

  // Memory lifecycle
  recordSession(session: SessionRecord): Promise<void>;
  compactMemory(): Promise<CompactionResult>;

  // Introspection
  getStats(): Promise<BrainStats>;
}

export interface ContextBundle {
  relevantFiles: FileContext[];
  architectureSummary: string;
  relatedSessions: SessionSummary[];
  relevantSymbols: SymbolInfo[];
  codingPatterns: string[];
  totalTokenEstimate: number;
}
```

#### Workflow Engine Interface

```typescript
// packages/workflow/src/types.ts

export interface WorkflowDefinition {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  concurrency?: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  provider?: string;              // Preferred provider
  prompt: string | PromptTemplate;
  dependsOn?: string[];           // Step IDs — DAG edges
  retryPolicy?: RetryPolicy;
  timeout?: number;
  outputVariable?: string;        // Store result for downstream steps
}

export interface WorkflowExecution {
  readonly id: string;
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly steps: Map<string, StepExecution>;
  
  start(): AsyncGenerator<WorkflowEvent>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  abort(): Promise<void>;
}
```

#### Plugin System Interface

```typescript
// packages/plugins/src/types.ts

export interface MetaCLIPlugin {
  readonly name: string;
  readonly version: string;

  activate(api: PluginAPI): Promise<void>;
  deactivate(): Promise<void>;
}

export interface PluginAPI {
  // Events
  on(event: string, handler: EventHandler): void;
  emit(event: string, data: unknown): void;

  // Adapters
  registerAdapter(adapter: AIAdapter): void;

  // Workflows
  registerWorkflowStep(step: WorkflowStepFactory): void;

  // Memory
  addMemoryEntry(entry: Partial<MemoryEntry>): Promise<void>;
  queryMemory(query: RetrievalQuery): Promise<MemoryEntry[]>;

  // Commands
  registerCommand(name: string, handler: CommandHandler): void;

  // UI
  registerStatusWidget(widget: StatusWidget): void;
}
```

### 2.3 Subprocess Orchestration Layer — How It Actually Works

This is the heart of MetaCLI. Here's the detailed flow:

```
User: metacli ask "build auth middleware"
  │
  ▼
┌─────────────────────┐
│   CLI (Ink UI)       │ ← Renders streaming output, status, provider info
│   apps/cli/          │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Orchestrator       │ ← Main coordination loop
│   core/orchestrator/ │
└────────┬────────────┘
         │
         ├── 1. Retrieve context from Brain
         │     │
         │     ▼
         │   ┌──────────────┐
         │   │ Brain/Memory │ → Returns: architecture summary, relevant files,
         │   │              │   related symbols, prior sessions, coding patterns
         │   └──────────────┘
         │
         ├── 2. Build enriched prompt
         │     Combines: user prompt + retrieved context + system instructions
         │
         ├── 3. Route to provider
         │     │
         │     ▼
         │   ┌───────────────────┐
         │   │ Provider Router   │ → Selects provider based on:
         │   │                   │   - User preference
         │   │                   │   - Health scores
         │   │                   │   - Rate limit status
         │   │                   │   - Cooldown timers
         │   │                   │   - Workflow role assignment
         │   └───────┬───────────┘
         │           │
         │           ▼
         │   ┌───────────────────┐
         │   │ Claude Adapter    │ → Spawns subprocess:
         │   │                   │   execa('claude', ['-p', '--output-format',
         │   │                   │          'stream-json', enrichedPrompt],
         │   │                   │          { cwd: projectDir, env: userEnv })
         │   └───────┬───────────┘
         │           │
         │           │ AsyncGenerator<StreamEvent>
         │           │ (parsed from stream-json stdout)
         │           │
         ├── 4. Stream response to UI
         │     │
         │     ▼
         │   ┌──────────────┐
         │   │ Ink UI       │ → Renders streamed text, tool calls, thinking
         │   └──────────────┘
         │
         ├── 5. Handle failures → FallbackEngine
         │     On rate limit or error:
         │     → Route to next healthy provider
         │     → Resume streaming from fallback
         │
         └── 6. Post-session memory update
               │
               ▼
             ┌──────────────┐
             │ Brain/Memory │ → Records session, updates architecture understanding,
             │              │   refreshes embeddings for changed files,
             │              │   updates knowledge graph relationships,
             │              │   compacts old sessions
             └──────────────┘
```

### 2.4 Memory System Architecture — Deep Design

```
┌─────────────────────────────────────────────────────────────┐
│                     MemoryManager                           │
│  Coordinates all memory layers, handles promotion/demotion  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │ Hot Memory   │  │ Warm Memory  │  │ Cold Memory    │    │
│  │             │  │              │  │                │    │
│  │ • Current   │  │ • Last 10    │  │ • Compressed   │    │
│  │   session   │  │   session    │  │   architecture │    │
│  │ • Active    │  │   summaries  │  │   knowledge    │    │
│  │   context   │  │ • Recent     │  │ • Long-term    │    │
│  │ • Working   │  │   decisions  │  │   decisions    │    │
│  │   files     │  │ • Pattern    │  │ • Compacted    │    │
│  │             │  │   cache      │  │   history      │    │
│  │ In-memory   │  │ SQLite       │  │ SQLite +       │    │
│  │ Map/LRU     │  │              │  │ Markdown       │    │
│  └─────────────┘  └──────────────┘  └────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Semantic Memory                                      │   │
│  │                                                      │   │
│  │ • Code chunk embeddings (tree-sitter + Transformers) │   │
│  │ • Session summary embeddings                         │   │
│  │ • Architecture description embeddings                │   │
│  │ • Hybrid retrieval (Vector + BM25 keyword)          │   │
│  │                                                      │   │
│  │ LanceDB (disk-based, serverless)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Knowledge Graph                                      │   │
│  │                                                      │   │
│  │ Nodes: Module, Class, Function, Route, Service,     │   │
│  │        Hook, API, Config, Test                       │   │
│  │                                                      │   │
│  │ Edges: IMPORTS, CALLS, DEFINES, DEPENDS_ON,         │   │
│  │        IMPLEMENTS, TESTS, ROUTES_TO, OWNS           │   │
│  │                                                      │   │
│  │ SQLite + in-memory graph (lightweight, no Neo4j)    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Project Brain Data Store (`.metacli/`)

```
project/
  .metacli/
    brain/
      architecture.md              ← AI-generated architecture narrative
      project_map.json             ← Module hierarchy, entry points
      dependency_graph.json        ← Import/export relationships
      module_index.json            ← Module purposes and relationships
      api_index.json               ← API endpoints and handlers
      symbol_index.json            ← Functions, classes, interfaces
      coding_patterns.md           ← Detected conventions and patterns
      decisions.md                 ← Architectural decisions log
      active_context.json          ← Current working context
      compressed_memory.md         ← Compacted long-term knowledge
    knowledge_graph/
      entities.json                ← Graph nodes
      relations.json               ← Graph edges
    sessions/
      history/                     ← Raw session transcripts
      summaries/                   ← Compressed session summaries
    embeddings/
      vectors.lance                ← LanceDB vector store
    cache/
      file_hashes.json             ← For incremental update detection
    config.yaml                    ← Project-level MetaCLI settings
```

#### Memory Evolution Pipeline — Post-Session Hook

```typescript
// Triggered after EVERY prompt/session
async function evolveMemory(session: SessionRecord): Promise<void> {
  // 1. Detect which files changed during the session
  const changedFiles = await detectChanges(session.fileOperations);

  // 2. Incrementally re-index only changed files
  for (const file of changedFiles) {
    await symbolIndexer.reindexFile(file);        // tree-sitter AST parse
    await dependencyGrapher.updateFile(file);      // Import/export updates
    await embeddingGenerator.reembedFile(file);     // Regenerate vectors
    await knowledgeGraph.updateRelations(file);     // Update graph edges
  }

  // 3. Summarize the session
  const summary = await sessionCompactor.summarize(session);

  // 4. Store in appropriate memory tiers
  await warmMemory.store(summary);                  // Recent summary

  // 5. Check if architecture understanding needs updating
  if (session.involvedArchitecturalChanges) {
    await architectureInferrer.refresh();
    await coldMemory.updateArchitecture();
  }

  // 6. Compact old warm memory into cold memory
  await memoryCompressor.compactIfNeeded();

  // 7. Update active context
  await hotMemory.setActiveContext({
    recentFiles: session.touchedFiles,
    recentDecisions: session.decisions,
    currentGoal: session.inferredGoal,
  });
}
```

### 2.5 Provider Router — Fallback & Health Scoring

```typescript
export class ProviderRouter {
  private healthScores: Map<string, HealthScore> = new Map();
  private cooldowns: Map<string, Date> = new Map();

  async selectProvider(request: RoutingRequest): Promise<AIAdapter> {
    const candidates = await this.getAvailableProviders();

    // 1. Apply user preferences (explicit provider pinning)
    if (request.preferredProvider) {
      const preferred = candidates.find(c => c.id === request.preferredProvider);
      if (preferred && this.isHealthy(preferred.id)) {
        return preferred;
      }
    }

    // 2. Filter out providers in cooldown
    const healthy = candidates.filter(c =>
      this.isHealthy(c.id) && !this.isInCooldown(c.id)
    );

    if (healthy.length === 0) {
      // All providers exhausted — find shortest cooldown
      const soonest = this.getShortestCooldown();
      throw new AllProvidersExhaustedError(soonest);
    }

    // 3. Score and rank
    return healthy.sort((a, b) =>
      this.getScore(b.id) - this.getScore(a.id)
    )[0];
  }

  recordOutcome(providerId: string, outcome: RequestOutcome): void {
    const score = this.healthScores.get(providerId);
    if (!score) return;

    // Exponential moving average
    const alpha = 0.3;
    score.value = alpha * (outcome.success ? 100 : 0) + (1 - alpha) * score.value;

    if (outcome.rateLimited) {
      this.cooldowns.set(providerId, outcome.retryAfter ?? addMinutes(new Date(), 5));
    }
  }
}
```

### 2.6 Tmux Integration Architecture

```
┌─────────────────────────────────────────────────────┐
│  tmux session: metacli-workspace                    │
│                                                     │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ Pane 0: Planner  │  │ Pane 1: Coder          │  │
│  │ [Claude Code]    │  │ [Gemini CLI]           │  │
│  │                  │  │                        │  │
│  │ > Planning...    │  │ > Generating code...   │  │
│  │ > Step 2/5       │  │ > File: auth.ts        │  │
│  └──────────────────┘  └────────────────────────┘  │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │ Pane 2: Reviewer │  │ Pane 3: Dashboard      │  │
│  │ [Claude Code]    │  │ [MetaCLI Status]       │  │
│  │                  │  │                        │  │
│  │ > Waiting for    │  │ Claude: ████░ 72%      │  │
│  │   coder output   │  │ Gemini: ██░░░ 40%      │  │
│  │                  │  │ Memory: 2.3MB indexed   │  │
│  └──────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

MetaCLI drives tmux via shell commands (no heavy Python dependency):

```typescript
export class TmuxController {
  async createSession(name: string): Promise<void> {
    await execa('tmux', ['new-session', '-d', '-s', name]);
  }

  async createPane(sessionName: string, direction: 'h' | 'v'): Promise<string> {
    const { stdout } = await execa('tmux', [
      'split-window', direction === 'h' ? '-h' : '-v',
      '-t', sessionName,
      '-P', '-F', '#{pane_id}'
    ]);
    return stdout.trim();
  }

  async sendToPane(paneId: string, command: string): Promise<void> {
    await execa('tmux', ['send-keys', '-t', paneId, command, 'Enter']);
  }

  async capturePane(paneId: string): Promise<string> {
    const { stdout } = await execa('tmux', [
      'capture-pane', '-t', paneId, '-p', '-S', '-100'
    ]);
    return stdout;
  }
}
```

### 2.7 Event System Architecture

The entire system is connected via a typed event bus — this is the nervous system.

```typescript
export type MetaCLIEvents = {
  // Provider events
  'provider:detected':      { adapterId: string; version: string };
  'provider:auth_valid':    { adapterId: string };
  'provider:auth_expired':  { adapterId: string };
  'provider:rate_limited':  { adapterId: string; retryAfter?: Date };
  'provider:healthy':       { adapterId: string; score: number };
  'provider:unhealthy':     { adapterId: string; reason: string };

  // Orchestration events
  'prompt:start':           { promptId: string; provider: string; prompt: string };
  'prompt:stream':          { promptId: string; event: StreamEvent };
  'prompt:complete':        { promptId: string; usage: UsageEstimate };
  'prompt:fallback':        { promptId: string; from: string; to: string; reason: string };
  'prompt:error':           { promptId: string; error: Error };

  // Memory events
  'brain:scan_start':       { projectPath: string };
  'brain:scan_progress':    { phase: string; progress: number };
  'brain:scan_complete':    { stats: BrainStats };
  'brain:memory_updated':   { tier: string; entriesChanged: number };
  'brain:compaction':       { before: number; after: number };

  // Workflow events
  'workflow:start':         { workflowId: string; name: string };
  'workflow:step_start':    { workflowId: string; stepId: string };
  'workflow:step_complete':  { workflowId: string; stepId: string };
  'workflow:complete':      { workflowId: string };
  'workflow:error':         { workflowId: string; stepId: string; error: Error };

  // Session events
  'session:start':          { sessionId: string };
  'session:end':            { sessionId: string; summary: string };
};
```

### 2.8 Advanced Sovereign Intelligence Subsystems

MetaCLI implements a suite of 17 self-optimizing runtime subsystems to establish **Persistent Autonomous Engineering Intelligence**:

1. **Prompt Compiler (`PromptCompiler.ts`)**: Compiles specialized prompts based on developer classification intents and provider types (Claude XML vs. Gemini Markdown structures).
2. **Context Optimizer (`ContextOptimizer.ts`)**: Prunes codebase inputs dynamically based on token budgets and token approximations.
3. **Evolving Codebase Brain (`BrainEvolutionEngine.ts`)**: Updates knowledge graphs post-prompt when files are modified on disk.
4. **Session Compactor (`SessionCompactor.ts`)**: Consolidates infinite hot history into warm summary layers in SQLite.
5. **Intent Classifier (`IntentClassifier.ts`)**: Heuristically detects prompt intents (debugging, refactoring, security, optimize, etc.) to alter search priorities.
6. **Provider Benchmarking Engine (`ProviderBenchmarkEngine.ts`)**: Rates and specializes routing paths based on observed speeds and failure rates.
7. **Semantic Graph Intelligence (`SemanticGraphIntelligence.ts`)**: Traversals relational tables and evaluates coupling scores.
8. **Architecture Timeline Engine (`ArchitectureTimelineEngine.ts`)**: Persists chronological logs of system design snapshots.
9. **Semantic Project Map Generator (`SemanticProjectMapGenerator.ts`)**: Generates functional domain maps (e.g. Auth, Data, UI).
10. **Predictive Context preloading (`PredictiveContextEngine.ts`)**: Proactively caches direct imports and sibling buffers in the background.
11. **Memory Confidence Engine (`MemoryConfidenceEngine.ts`)**: Scores aging indexes to drops outdated context and avoid hallucinations.
12. **Brain Telemetry & Observability (`BrainTelemetry.ts`)**: Exposes latency logs and search precision percentages.
13. **Replay Engine (`ReplayEngine.ts`)**: Records session states to enable deterministic dry-runs.
14. **Plugin SDK (`PluginSDK.ts`)**: Exposes typed onLoad/onUnload registration channels.
15. **Event-Driven Substrate**: Custom async pipeline subscriptions.
16. **Retrieval Explainability Engine (`RetrievalExplainabilityEngine.ts`)**: Generates trace trace-reason logs on context inclusions.
17. **Active Modularity Analysis (`ActiveArchitectureIntelligence.ts`)**: Automatically identifies circular reference paths, dead systems, and decay metrics.

---

## Part 3: Engineering Analysis & Honest Critique

### 3.1 Architecture Risks — What Could Go Wrong

#### Risk 1: Subprocess Reliability (SEVERITY: HIGH)

**Problem**: AI CLIs are moving targets. Claude Code and Gemini CLI update frequently. A `--output-format stream-json` flag could change behavior, add fields, or break parsing between versions.

**Mitigation**:
- Version-pinned adapter logic (detect CLI version, select parser)
- Defensive JSON parsing with schema validation (zod)
- Integration test suite that runs against actual CLIs
- Adapter versioning independent of MetaCLI core releases

**Honest assessment**: This is the single biggest maintenance risk. Every CLI update is a potential breakage point. Budget significant ongoing maintenance for adapter compatibility.

---

#### Risk 2: Auth Session Fragility (SEVERITY: MEDIUM-HIGH)

**Problem**: OAuth tokens expire. Browser login sessions can be invalidated server-side. MetaCLI has ZERO control over auth — it's the provider's domain.

**Mitigation**:
- Pre-flight auth checks before routing (`checkAuth()`)
- Graceful fallback when auth fails mid-stream
- Clear user-facing messages: "Claude session expired. Run `claude login` to re-authenticate."
- Never cache, store, or proxy auth tokens

**Honest assessment**: This works well for persistent OAuth sessions (Claude, Gemini) but creates friction for CLIs that require re-auth frequently. API-key-based CLIs (Aider, Codex) are more reliable for automation.

---

#### Risk 3: Rate Limit Opacity (SEVERITY: MEDIUM)

**Problem**: Providers don't expose exact quota APIs. Claude's 5-hour rolling window is estimated from heuristics, not an endpoint. Gemini's free tier limits vary unpredictably.

**Mitigation**:
- Heuristic-based estimation from observed behavior
- Parse error messages for reset timestamps
- Conservative health scoring (assume limits are lower than observed)
- Never promise exact quota numbers to users — present as estimates

**Honest assessment**: Rate limit intelligence will always be approximate. Don't over-engineer this. A simple "provider seems rate-limited, falling back" UX is more honest than fake quota dashboards.

---

#### Risk 4: Memory System Complexity (SEVERITY: MEDIUM)

**Problem**: The brain/memory system is the most ambitious component. Building a full knowledge graph + vector store + hierarchical memory is complex, and the ROI is unclear until tested with real projects.

**Mitigation**:
- Phase the memory system (see roadmap below)
- Start with file indexing + simple keyword retrieval
- Add vector/semantic retrieval in Phase 2
- Add knowledge graph in Phase 3
- Validate each layer's ROI before adding the next

**Honest assessment**: Start simpler than the full vision. A project that indexes files, tracks recent sessions, and does keyword retrieval will deliver 80% of the value with 20% of the complexity. The full knowledge graph + hierarchical compression system is Phase 3+ territory.

---

#### Risk 5: Embedding Generation Performance (SEVERITY: LOW-MEDIUM)

**Problem**: Running local embedding models (Transformers.js) on large codebases is computationally expensive. Initial scan of a 10K-file monorepo could take minutes.

**Mitigation**:
- Incremental indexing (hash-based change detection)
- Background indexing with progress reporting
- Configurable embedding model size (smaller = faster but less accurate)
- Skip binary files, node_modules, build artifacts
- Lazy embedding: only embed files that are retrieved

**Honest assessment**: For initial scans, consider offering a "lite mode" that skips embeddings entirely and uses only keyword/AST-based retrieval. Embeddings are a luxury for large codebases, not a requirement.

---

#### Risk 6: Cross-Platform PTY Issues (SEVERITY: LOW-MEDIUM)

**Problem**: node-pty requires native compilation. Windows support is historically painful. Even on macOS, node-pty can conflict with system integrity protection.

**Mitigation**:
- Use execa as default — node-pty is optional fallback only
- Gate node-pty behind a feature flag: `--pty-mode`
- Provide clear error messages if node-pty fails to compile
- Consider not shipping node-pty in v1 at all

---

### 3.2 What I Would Push Back On

As a principal engineer, here's where I'd challenge the original spec:

> [!WARNING]
> **1. The knowledge graph is premature optimization.** For an MVP, file indexing + symbol indexing + keyword retrieval provides excellent context. A full entity-relation knowledge graph with `CALLS`, `IMPORTS`, `IMPLEMENTS` edges is a significant engineering investment that should be validated against simpler approaches first.

> [!WARNING]
> **2. Session compaction via AI is expensive.** Summarizing sessions automatically requires calling an AI model — which costs tokens/quota. For login-based users with limited quotas, this creates a paradox: the tool that's supposed to save quota spends quota on memory management. Consider deterministic summarization first (extracting file changes, commands, key decisions via regex/heuristics).

> [!WARNING]
> **3. tmux integration should be optional, not core.** Many developers don't use tmux. Building tmux as a core dependency creates friction. It should be an opt-in plugin that enhances multi-agent workflows.

> [!WARNING]
> **4. Workflow engine complexity.** DAG-based multi-agent workflows sound impressive, but the UX for defining, debugging, and monitoring them is extremely hard to get right. Start with simple sequential workflows (plan → code → review) before building a full DAG executor.

> [!IMPORTANT]
> **5. Don't build embedding generation into v1.** Use an existing local embedding service (like Ollama's embedding endpoint or a dedicated ONNX model server) rather than bundling Transformers.js. This reduces bundle size, avoids ONNX native addon issues, and lets users choose their hardware acceleration.

---

## Part 4: Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3) — MVP

**Goal**: A working CLI that can route prompts to Claude Code and Gemini CLI with fallback.

| Component | What to build |
|:----------|:-------------|
| Monorepo scaffold | pnpm workspace, turbo, tsconfig, eslint, prettier |
| `@metacli/core` | Orchestrator, ProviderRouter, FallbackEngine, EventBus |
| `@metacli/adapters` | `AIAdapter` interface, `SubprocessAdapter` base class |
| Claude adapter | Detection, auth check, prompt sending via `claude -p --output-format stream-json` |
| Gemini adapter | Detection, auth check, prompt sending via `gemini -p --output-format stream-json` |
| `@metacli/cli` | Basic Ink UI with streaming output, provider indicator |
| Config system | `~/.metacli/config.yaml` for provider preferences, routing rules |
| `@metacli/telemetry` | Basic usage tracking, health scoring |

**Deliverable**: `metacli ask "build auth middleware"` routes to Claude, falls back to Gemini on rate limit, streams output to terminal.

---

### Phase 2: Project Brain v1 (Weeks 4-6)

**Goal**: File-level project intelligence with simple retrieval.

| Component | What to build |
|:----------|:-------------|
| `@metacli/brain` | FileIndexer, SymbolIndexer (tree-sitter), DependencyGrapher |
| Initial scan | CLI command: `metacli scan` — indexes project files, symbols, imports |
| Incremental updates | Hash-based change detection, selective re-indexing |
| Context retrieval | Keyword-based retrieval: match prompt keywords to indexed symbols/files |
| Pre-session hook | Auto-retrieve relevant context before sending to provider |
| Persistence | SQLite for indexes, JSON for project map |
| `.metacli/` structure | `brain/project_map.json`, `brain/symbol_index.json`, `brain/dependency_graph.json` |

**Deliverable**: `metacli ask "fix the auth bug in the login handler"` automatically includes relevant auth files and handler definitions in the prompt context.

---

### Phase 3: Memory & Semantic Retrieval (Weeks 7-10)

**Goal**: Multi-tier memory system with semantic search.

| Component | What to build |
|:----------|:-------------|
| Hot/Warm/Cold memory | MemoryManager, session recording, deterministic session summarization |
| Embedding generation | Integration with local embedding service (Ollama or Transformers.js) |
| Vector store | LanceDB integration for semantic retrieval |
| Hybrid retrieval | Vector + BM25 keyword fusion |
| Memory evolution | Post-session memory update pipeline |
| Architecture inference | Auto-generate `architecture.md` from indexed data |

**Deliverable**: MetaCLI remembers past sessions, retrieves semantically relevant code, and builds an evolving understanding of the project.

---

### Phase 4: Workflows & Multi-Agent (Weeks 11-14)

**Goal**: Multi-step, multi-provider workflow execution.

| Component | What to build |
|:----------|:-------------|
| `@metacli/workflow` | WorkflowEngine, DAGExecutor, YAML workflow parser |
| Built-in workflows | plan-code-review, multi-agent-debug |
| Additional adapters | Aider, Codex, Cline, Goose |
| `@metacli/tmux` | TmuxController, PaneManager (optional) |
| Workflow UI | Ink-based workflow progress visualization |

**Deliverable**: `metacli workflow run plan-code-review` orchestrates Claude (planner) → Gemini (coder) → Claude (reviewer).

---

### Phase 5: Codebase Knowledge Graphs & Architectural Drift Detection (100% Completed)

**Goal**: Relational graph indexing, wildcard path matches, modular boundary restriction lints, and E2E type-safety validation.

| Component | What to build |
|:----------|:-------------|
| Knowledge Graph schema | SQLite `graph_nodes` & `graph_edges` tables, cascaded deletes |
| CRUD transactions | Node/Edge transaction-safe SQL CRUD persistence |
| `ArchitectureDriftDetector` | Wildcard path regex converter linting boundary couplings |
| TS Composite fix | Enabled `composite: true` monorepos project reference compiler builds |

---

### Phase 6: Advanced Intelligence Layer & Persistent Engineering Runtime (100% Completed)

**Goal**: Full self-optimizing orchestration context loops, plugin loader SDK lifecycles, and deterministic session replays.

| Component | What to build |
|:----------|:-------------|
| `@metacli/core` | PromptCompiler, ContextOptimizer, IntentClassifier, ProviderBenchmarkEngine, PredictiveContextEngine, ReplayEngine, RetrievalExplainabilityEngine, ActiveArchitectureIntelligence |
| `@metacli/brain` | BrainEvolutionEngine, SessionCompactor, MemoryConfidenceEngine, SemanticGraphIntelligence, ArchitectureTimelineEngine, SemanticProjectMapGenerator |
| `@metacli/telemetry` | BrainTelemetry records and reports |
| `@metacli/plugins` | PluginSDK, MetaCLIPlugin registration registers |

---

## Part 5: Technology Stack Summary

| Layer | Technology | Rationale |
|:------|:-----------|:----------|
| **Language** | TypeScript (strict mode) | Type safety, ecosystem, developer familiarity |
| **Runtime** | Node.js 22+ | LTS, native ESM, stable subprocess APIs |
| **Package manager** | pnpm | Strict dependency isolation, workspace protocol, catalogs |
| **Build orchestration** | Turborepo | Smart caching, parallel execution, dependency-aware |
| **Subprocess execution** | execa (primary), node-pty (optional) | Clean pipe I/O for non-interactive, PTY for interactive |
| **Terminal UI** | Ink (React) | Industry standard, composable, streaming-friendly |
| **AST parsing** | tree-sitter (via `tree-sitter` npm) | Incremental, error-tolerant, language-agnostic |
| **Vector store** | LanceDB | Embedded, serverless, TypeScript-native, disk-efficient |
| **Persistence** | better-sqlite3 | Zero-config, single-file, fast, widely supported |
| **Schema validation** | zod | Runtime type safety for CLI outputs, configs, events |
| **Embeddings** | Transformers.js v4 (Phase 3+) or Ollama | Local, private, no API costs |
| **Configuration** | cosmiconfig + YAML | Standard config discovery, human-readable format |
| **Testing** | vitest | Fast, ESM-native, TypeScript-first |
| **Linting** | eslint + prettier | Consistency, auto-formatting |

---

## Part 6: Verification Plan

### Automated Tests

```bash
# Unit tests — run per-package
pnpm turbo run test

# Integration tests — require CLI installations
pnpm turbo run test:integration

# E2E test — full metacli ask flow
pnpm --filter @metacli/cli run test:e2e
```

**Key test scenarios:**
1. Adapter detection: verify Claude/Gemini CLI detection on systems where they are installed
2. Subprocess lifecycle: spawn, stream, complete, abort
3. Fallback: simulate rate limit → verify provider switch
4. Memory: index project → verify symbol retrieval
5. Workflow: execute DAG → verify step ordering

### Manual Verification
- Run `metacli ask` against a real project with Claude Code installed
- Verify OAuth session reuse (no re-login required)
- Verify rate limit detection and fallback
- Verify `.metacli/brain/` artifacts are created and updated

---

## Open Questions

> [!IMPORTANT]
> **Q1: Which CLIs do you currently have installed?** This determines which adapters to build and test first in Phase 1. Claude Code and Gemini CLI appear to be the most subprocess-friendly.

> [!IMPORTANT]
> **Q2: Do you use tmux currently?** If not, tmux integration should be deprioritized to Phase 4+ and made purely optional.

> [!IMPORTANT]
> **Q3: What's your primary project size?** (small: <100 files, medium: 100-1K, large: 1K+). This impacts memory system design — specifically whether we need incremental indexing from day 1 or can get away with full scans for MVP.

> [!IMPORTANT]
> **Q4: Local embedding preference?** Do you run Ollama locally? If so, we can use its embedding endpoint instead of bundling Transformers.js, which reduces install complexity significantly.

> [!IMPORTANT]
> **Q5: MVP scope agreement.** The phased roadmap puts knowledge graph, AI-assisted compaction, and tmux in later phases. Do you agree with this prioritization, or are any of these critical for your day-1 workflow?

> [!IMPORTANT]
> **Q6: Naming convention for the CLI binary.** Should the command be `metacli`, `meta`, `mcli`, or something else? This affects package naming and documentation.
