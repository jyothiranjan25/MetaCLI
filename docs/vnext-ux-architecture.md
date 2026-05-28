# MetaCLI vNext UX Architecture

MetaCLI is an AI-native engineering operating system, not a chat app and not a dashboard. The UI is centered on a living conversation with visible cognition, retrieval trust, token intelligence, and transient command surfaces.

## Component Hierarchy

ConversationRuntime
- IntelligenceHeader
- CommandPalette
- OverlayManager
- ConversationStream
- CognitiveStream
- CommandLayer

OverlayManager
- BrainOverlay
- MemoryOverlay
- ProvidersOverlay
- MapOverlay
- TimelineOverlay
- GraphOverlay
- ContextOverlay
- WorkflowsOverlay
- TelemetryOverlay
- ReplayOverlay
- SettingsOverlay

## Layout Architecture

The screen has five regions:
- Intelligence Header: one compact line with workspace, brain warmth, provider, memory count, context state, token efficiency, and status pulse.
- Conversation Stream: primary surface, 70-80 percent of horizontal attention.
- Cognitive Stream: narrow right-side activity stream for memory, graph, retrieval, routing, and workflow events.
- Command Layer: bottom input layer for natural prompts and slash commands.
- Status Pulse: tiny live indicator in the header.

No tabs. No persistent dashboard panels. No boxed page layouts.

## Rendering Strategy

The root runtime renders the conversation by default. Command palette and overlays are transient layers that temporarily occupy the main region and close instantly with ESC. The conversation remains the conceptual home; overlays inspect state without navigating away.

Streaming responses render inline. Retrieval visibility is attached to assistant responses and shows retrieved items, reason, confidence, and token savings.

## Overlay Architecture

Slash commands open overlays:
- `/brain`: project brain summary
- `/memory`: memory layers
- `/providers`: provider health
- `/graph`: dependency graph
- `/map`: repository topology
- `/timeline`: project evolution
- `/context`: retrieval context
- `/workflows`: workflow state
- `/settings`: configuration

Overlays use simple separators and dense text. They avoid cards, nested panels, and dashboard-like metric grids unless the data itself is tabular.

## Keyboard Model

- `Ctrl+K`: universal command palette
- `/`: slash command mode
- `Enter`: send prompt or execute command
- `Up/Down`: command suggestions
- `ESC`: close palette or overlay
- `Ctrl+C`: exit
- Startup continuation: `Y` resumes previous thread, `N` starts a new session

## Animation Model

Animations are subtle and semantic:
- Pulse states: indexing, retrieving, thinking, routing, idle
- Spinner only during active processing
- Cognitive stream logs state transitions instead of flashing UI

No flashy effects. Motion exists to communicate liveness.

## Typography System

- Product identity: bold white
- Primary text: white
- Labels and metadata: gray
- Active semantic state: green
- Commands and navigable concepts: cyan
- Warnings: yellow
- User identity: magenta

The UI relies on hierarchy, spacing, and alignment rather than borders.

## Color System

The palette is restrained:
- White: primary content
- Gray: metadata, separators, inactive text
- Green: healthy, optimized, successful cognition
- Cyan: commands, active navigation, semantic affordances
- Yellow: warning or degraded state
- Magenta: user speaker identity

Avoid neon overload and large saturated surfaces.

## Adaptive Layout Engine

The runtime infers an adaptive mode from current input and recent prompts:
- Debug: compact local context
- Architecture: topology-heavy cognition
- Refactor: graph and dependency emphasis
- Planning: reasoning-heavy stream
- Compact: default low-noise mode

The current implementation exposes this mode in the cognitive stream. Future iterations should let the mode tune retrieval depth, overlay defaults, and context verbosity.

