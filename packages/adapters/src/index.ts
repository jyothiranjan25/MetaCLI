/**
 * MetaCLI Adapters — Public API
 */

// Base
export { SubprocessAdapter, type SpawnOptions } from './base/SubprocessAdapter.js';

// Discovery
export { ProviderDiscovery, type ProviderMetadata } from './discovery/ProviderDiscovery.js';

// Claude
export { ClaudeAdapter } from './claude/ClaudeAdapter.js';

// Gemini
export { GeminiAdapter } from './gemini/GeminiAdapter.js';

// Codex
export { CodexAdapter } from './codex/CodexAdapter.js';

// OpenCode
export { OpenCodeAdapter } from './opencode/OpenCodeAdapter.js';
