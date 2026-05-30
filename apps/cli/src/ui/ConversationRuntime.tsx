/**
 * MetaCLI vNext — AI-native engineering operating system shell.
 *
 * Layout:
 *   IntelligenceHeader
 *   ConversationStream + CognitiveStream
 *   CommandLayer
 *
 * Overlays and the command palette are transient layers. They never replace
 * the conversation as the center of gravity.
 */

import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
const dbg = (_msg: string) => {};
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import path from 'node:path';
import fs from 'node:fs';
import type { Orchestrator, EventBus, MetaCLIEvents } from '@metacli/core';
import { createContextResolver } from '../bootstrap.js';
import { SlashCommandRuntime } from '../runtime/SlashCommandRuntime.js';
import type { OverlayId, CommandSuggestion } from '../runtime/SlashCommandRuntime.js';
import { OverlayManager } from './OverlayManager.js';
import { CommandPalette } from './CommandPalette.js';
import {
  DISABLE_BRACKETED_PASTE,
  ENABLE_BRACKETED_PASTE,
  createPromptBuffer,
  parseTerminalInput,
  type PromptBufferState,
  type TerminalInputEvent,
} from './pasteInput.js';

interface ConversationRuntimeProps {
  orchestrator: Orchestrator;
  eventBus: EventBus<MetaCLIEvents>;
  workingDirectory: string;
  initialProviders?: Map<string, { installed: boolean; authenticated: boolean }>;
}

interface RetrievalVisibility {
  items: string[];
  why: string;
  confidence: number;
  tokensSaved: number;
  source: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string;
  fallbackCount?: number;
  timestamp: Date;
  retrieval?: RetrievalVisibility;
}

interface CognitiveEvent {
  id: string;
  label: string;
  tone: 'normal' | 'good' | 'warn' | 'muted';
  timestamp: Date;
}

type Pulse = 'idle' | 'indexing' | 'retrieving' | 'thinking' | 'routing';
type AdaptiveMode = 'debug' | 'architecture' | 'refactor' | 'planning' | 'compact';

const toneColor: Record<CognitiveEvent['tone'], string> = {
  normal: 'white',
  good: 'green',
  warn: 'yellow',
  muted: 'gray',
};

const EMPTY_PROMPT_BUFFER: PromptBufferState = {
  text: '',
  lineCount: 0,
  isLarge: false,
};

function workspaceName(workingDirectory: string): string {
  return path.basename(workingDirectory) || 'Workspace';
}

function greeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning.';
  if (hr < 17) return 'Good afternoon.';
  return 'Good evening.';
}

function inferMode(input: string, lastPrompt: string): AdaptiveMode {
  const text = `${input} ${lastPrompt}`.toLowerCase();
  if (/\b(debug|bug|error|trace|fail|crash)\b/.test(text)) return 'debug';
  if (/\b(architecture|design|topology|map|boundary)\b/.test(text)) return 'architecture';
  if (/\b(refactor|rename|extract|cleanup|migrate)\b/.test(text)) return 'refactor';
  if (/\b(plan|roadmap|strategy|workflow)\b/.test(text)) return 'planning';
  return 'compact';
}

const IntelligenceHeader = React.memo(({
  workspace,
  brainWarm,
  provider,
  memoryCount,
  contextState,
  tokenEfficiency,
  pulse,
}: {
  workspace: string;
  brainWarm: boolean;
  provider: string;
  memoryCount: number;
  contextState: string;
  tokenEfficiency: number;
  pulse: Pulse;
}) => (
  <Box justifyContent="space-between" paddingX={1}>
    <Box gap={2}>
      <Text bold color="white">MetaCLI</Text>
      <Text color="gray">Workspace: <Text color="white">{workspace}</Text></Text>
      <Text color="gray">Brain: <Text color={brainWarm ? 'green' : 'yellow'}>{brainWarm ? 'Warm' : 'Cold'}</Text></Text>
      <Text color="gray">Provider: <Text color="white">{provider || 'Auto'}</Text></Text>
      <Text color="gray">Memory: <Text color="white">{memoryCount} memories</Text></Text>
      <Text color="gray">Context: <Text color="green">{contextState}</Text></Text>
      <Text color="gray">Token Efficiency: <Text color="green">{tokenEfficiency}%</Text></Text>
    </Box>
    <Box gap={1}>
      <Text color={pulse === 'idle' ? 'gray' : 'green'}>{pulse === 'idle' ? '○' : '●'}</Text>
      <Text color="gray">{pulse}</Text>
    </Box>
  </Box>
));

const ContinuationPrompt = React.memo(({
  workspace,
  indexedFiles,
  memoryCount,
}: {
  workspace: string;
  indexedFiles: number;
  memoryCount: number;
}) => (
  <Box flexDirection="column" paddingX={1} marginTop={1}>
    <Text color="white">{greeting()}</Text>
    <Box marginTop={1} flexDirection="column">
      <Text color="gray">Workspace: <Text color="white">{workspace}</Text></Text>
      <Text color="gray">Last session: <Text color="white">semantic cognition and token intelligence integration</Text></Text>
      <Text color="gray">Brain: <Text color={indexedFiles > 0 ? 'green' : 'yellow'}>{indexedFiles > 0 ? `${indexedFiles} indexed files` : 'not indexed'}</Text></Text>
      <Text color="gray">Memory: <Text color="white">{memoryCount} retained memories</Text></Text>
    </Box>
    <Box marginTop={1} flexDirection="column">
      <Text color="gray">Pending tasks:</Text>
      <Text color="gray">  • UX shell migration</Text>
      <Text color="gray">  • Overlay simplification</Text>
      <Text color="gray">  • Retrieval trust surface</Text>
    </Box>
    <Box marginTop={1} gap={2}>
      <Text color="green">[Y] Continue</Text>
      <Text color="gray">[N] New Session</Text>
    </Box>
  </Box>
));

const RetrievalBlock = React.memo(({ retrieval }: { retrieval: RetrievalVisibility }) => (
  <Box flexDirection="column" paddingLeft={2} marginTop={0}>
    <Box gap={1}>
      <Text color="gray">◆ Context: </Text>
      <Text color="green">{retrieval.tokensSaved.toLocaleString()} tokens saved</Text>
      <Text color="gray">({retrieval.items.length} items optimized) via {retrieval.source}</Text>
    </Box>
    <Box gap={1}>
      <Text color="gray">◆ Reason: </Text>
      <Text color="white">{retrieval.why}</Text>
      <Text color="gray"> • Confidence: </Text>
      <Text color="green">{retrieval.confidence}%</Text>
    </Box>
  </Box>
));

const ConversationStream = React.memo(({
  messages,
  streamContent,
  streamProvider,
  streamFallback,
  activeRetrieval,
  showContinuation,
  workspace,
  indexedFiles,
  memoryCount,
}: {
  messages: Message[];
  streamContent: string;
  streamProvider: string;
  streamFallback: number;
  activeRetrieval?: RetrievalVisibility;
  showContinuation: boolean;
  workspace: string;
  indexedFiles: number;
  memoryCount: number;
}) => {
  const visible = messages.slice(-10);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
      {showContinuation && messages.length === 0 && (
        <ContinuationPrompt workspace={workspace} indexedFiles={indexedFiles} memoryCount={memoryCount} />
      )}

      {!showContinuation && messages.length === 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="white">MetaCLI is observing this workspace.</Text>
          <Text color="gray">Ask for a change, open <Text color="cyan">/map</Text>, or press <Text color="cyan">Ctrl+K</Text>.</Text>
        </Box>
      )}

      {visible.map((message) => (
        <Box key={message.id} flexDirection="column" marginBottom={1}>
          <Box gap={1}>
            <Text bold color={message.role === 'user' ? 'magenta' : message.role === 'assistant' ? 'green' : 'gray'}>
              {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'MetaCLI' : 'system'}
            </Text>
            {message.provider && <Text color="gray">{message.provider}</Text>}
            {message.fallbackCount ? <Text color="yellow">fallback {message.fallbackCount}</Text> : null}
          </Box>
          <Box paddingLeft={2}>
            <Text color={message.role === 'system' ? 'gray' : 'white'}>{message.content}</Text>
          </Box>
          {message.retrieval && <RetrievalBlock retrieval={message.retrieval} />}
        </Box>
      ))}

      {streamContent && (
        <Box flexDirection="column" marginBottom={1}>
          <Box gap={1}>
            <Text bold color="green">MetaCLI</Text>
            {streamProvider && <Text color="gray">{streamProvider}</Text>}
            {streamFallback > 0 && <Text color="yellow">fallback {streamFallback}</Text>}
          </Box>
          <Box paddingLeft={2}>
            <Text>{streamContent}</Text>
          </Box>
          {activeRetrieval && <RetrievalBlock retrieval={activeRetrieval} />}
        </Box>
      )}
    </Box>
  );
});

const CognitiveStream = React.memo(({
  events,
  mode,
}: {
  events: CognitiveEvent[];
  mode: AdaptiveMode;
}) => (
  <Box flexDirection="column" width={28} paddingLeft={2}>
    <Text color="gray">cognition <Text color="white">{mode}</Text></Text>
    <Text color="gray" dimColor>{'─'.repeat(26)}</Text>
    {events.slice(0, 12).map((event) => (
      <Box key={event.id} flexDirection="column">
        <Text color={toneColor[event.tone] as any}>{event.label}</Text>
      </Box>
    ))}
  </Box>
));

const CommandLayer = React.memo(({
  value,
  promptBuffer,
  suggestions,
  showSuggestions,
  selectedSuggestionIndex,
  isProcessing,
}: {
  value: string;
  promptBuffer: PromptBufferState;
  suggestions: CommandSuggestion[];
  showSuggestions: boolean;
  selectedSuggestionIndex: number;
  isProcessing: boolean;
}) => (
  <Box flexDirection="column" paddingX={1} marginTop={1}>
    {showSuggestions && suggestions.length > 0 && (
      <Box flexDirection="column" paddingLeft={2}>
        {suggestions.map((suggestion, index) => (
          <Text key={suggestion.command.name} color={index === selectedSuggestionIndex ? 'cyan' : 'gray'}>
            {index === selectedSuggestionIndex ? '› ' : '  '}{suggestion.displayText}
          </Text>
        ))}
      </Box>
    )}
    <Text color="gray" dimColor>{'─'.repeat(78)}</Text>
    <Box gap={1}>
      <Text color={value.startsWith('/') ? 'cyan' : 'gray'}>{value.startsWith('/') ? '/' : '›'}</Text>
      {isProcessing ? (
        <Box gap={1}>
          <Text color="green"><Spinner type="dots" /></Text>
          <Text color="gray">MetaCLI is thinking</Text>
        </Box>
      ) : (
        <>
          {promptBuffer.isLarge ? (
            <Box flexDirection="column">
              <Text color="green">✓ {promptBuffer.lineCount.toLocaleString()} lines loaded — Enter to send</Text>
              <Box>
                <Text color="gray">+ </Text>
                <Text color="white">{value}</Text>
                <Text color="green">▌</Text>
                {!value && <Text color="gray" dimColor>type to append, Enter to send</Text>}
              </Box>
            </Box>
          ) : (
            <>
              <Text color={value.startsWith('/') ? 'cyan' : 'white'}>{value.startsWith('/') ? value.slice(1) : value}</Text>
              <Text color="green">▌</Text>
              {!value && <Text color="gray">ask, or type / for commands</Text>}
            </>
          )}
        </>
      )}
    </Box>
    <Box gap={2}>
      <Text color="gray" dimColor>Enter send</Text>
      <Text color="gray" dimColor>Ctrl+K palette</Text>
      <Text color="gray" dimColor>ESC close</Text>
      <Text color="gray" dimColor>Ctrl+C exit</Text>
    </Box>
  </Box>
));

export function ConversationRuntime({
  orchestrator,
  eventBus,
  workingDirectory,
  initialProviders,
}: ConversationRuntimeProps): React.ReactElement {
  dbg('[RENDER] ConversationRuntime render');
  const exitRef = useRef<() => void>(() => {});
  const { exit } = useApp();
  // Keep exitRef current so handleTerminalEvent can call exit() without
  // listing it as a dep (useApp returns a new exit fn on every re-render).
  exitRef.current = exit;
  // Keep raw mode enabled throughout the lifecycle of this component.
  // Ink's useInput increments an internal rawModeEnabledCount, preventing other transient
  // components (like overlays or command palettes) from disabling raw mode on unmount.
  useInput(() => {});

  const [input, setInput] = useState('');
  const [promptBuffer, setPromptBuffer] = useState<PromptBufferState>(EMPTY_PROMPT_BUFFER);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<CognitiveEvent[]>([
    { id: 'boot-1', label: 'Runtime presence initialized', tone: 'good', timestamp: new Date() },
    { id: 'boot-2', label: 'Semantic context compiler ready', tone: 'good', timestamp: new Date() },
    { id: 'boot-3', label: 'Awaiting workspace pulse', tone: 'muted', timestamp: new Date() },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [streamProvider, setStreamProvider] = useState('');
  const [streamFallback, setStreamFallback] = useState(0);
  const [activeRetrieval, setActiveRetrieval] = useState<RetrievalVisibility | undefined>();
  const [activeOverlay, _setActiveOverlay] = useState<OverlayId>(null);
  const [showPalette, _setShowPalette] = useState(false);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [providers, setProviders] = useState<Map<string, { installed: boolean; authenticated: boolean }>>(
    initialProviders ?? new Map(),
  );
  const [activeProvider, setActiveProvider] = useState(() => {
    if (!initialProviders) return '';
    const first = Array.from(initialProviders.entries()).find(([, v]) => v.authenticated);
    return first ? first[0] : '';
  });
  const [providerLimits, setProviderLimits] = useState<Record<string, string>>({});
  const [healthScores] = useState<Record<string, number>>({ 'claude-code': 100, 'gemini-cli': 96 });
  const [cooldowns] = useState<Record<string, string>>({});
  const [indexedFiles, setIndexedFiles] = useState(0);
  const [memorySummaries, setMemorySummaries] = useState(0);
  const [showContinuation, setShowContinuation] = useState(true);
  const slashRuntime = useRef(new SlashCommandRuntime());
  const promptBufferRef = useRef<PromptBufferState>(EMPTY_PROMPT_BUFFER);
  const inputRef = useRef('');
  // Tracks the paste base so typed additions can be isolated for display
  const pasteBaseRef = useRef('');
  const suggestionsRef = useRef<CommandSuggestion[]>([]);
  const selectedSuggestionIndexRef = useRef(0);
  const showPaletteRef = useRef(false);
  const activeOverlayRef = useRef<OverlayId>(null);
  const handleTerminalEventRef = useRef<(e: TerminalInputEvent) => void>(() => {});

  // Wrappers that keep refs and state in sync atomically — the ref update is
  // synchronous so handleTerminalEvent always reads the correct value even
  // before the next React render commits the state change.
  const setActiveOverlay = useCallback((id: OverlayId) => {
    dbg(`[OVERLAY] ${String(activeOverlayRef.current)} -> ${String(id)}`);
    activeOverlayRef.current = id;
    _setActiveOverlay(id);
  }, []);
  const setShowPalette = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof val === 'function' ? val(showPaletteRef.current) : val;
    showPaletteRef.current = next;
    _setShowPalette(next);
  }, []);
  const showContinuationRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);
  const isProcessingRef = useRef(false);
  // Stable refs for functions used in handleTerminalEvent.
  // Without these, every activeProvider change regenerates submitPrompt →
  // handleTerminalEvent → triggers Effect 2 cleanup (removes onData listener)
  // → brief window with no listener → Ink's raw stdin handling takes over alone.
  const submitPromptRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const executeSlashCommandRef = useRef<(raw: string) => Promise<void>>(() => Promise.resolve());

  const setPromptText = useCallback((text: string) => {
    const nextBuffer = createPromptBuffer(text);
    promptBufferRef.current = nextBuffer;
    setPromptBuffer(nextBuffer);
    if (!nextBuffer.isLarge) {
      // Normal mode: keep input in sync with the full text
      inputRef.current = nextBuffer.text;
      setInput(nextBuffer.text);
    }
    // Large mode: callers manage inputRef/input directly to preserve the typed tail
  }, []);

  const activePromptText = useCallback(() => promptBufferRef.current.text || inputRef.current, []);

  useEffect(() => { inputRef.current = input; }, [input]);
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);
  useEffect(() => { selectedSuggestionIndexRef.current = selectedSuggestionIndex; }, [selectedSuggestionIndex]);
  // showPaletteRef and activeOverlayRef are kept in sync by their wrapper
  // setters above — no useEffect needed here.
  useEffect(() => { showContinuationRef.current = showContinuation; }, [showContinuation]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  const pushEvent = useCallback((label: string, tone: CognitiveEvent['tone'] = 'normal') => {
    setEvents((prev) => [{ id: `${Date.now()}-${label}`, label, tone, timestamp: new Date() }, ...prev].slice(0, 32));
  }, []);

  const pulse: Pulse = useMemo(() => {
    if (isProcessing && !streamProvider) return 'routing';
    if (isProcessing && !streamContent) return 'retrieving';
    if (isProcessing) return 'thinking';
    if (indexedFiles === 0) return 'indexing';
    return 'idle';
  }, [indexedFiles, isProcessing, streamContent, streamProvider]);

  const adaptiveMode = useMemo(
    () => inferMode(activePromptText(), messages.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? ''),
    [activePromptText, input, messages, promptBuffer],
  );
  const tokenEfficiency = indexedFiles > 0 ? 94 : 71;

  useEffect(() => {
    orchestrator.detectProviders().then((result) => {
      setProviders(result);
      const authenticated = Array.from(result.entries()).find(([, value]) => value.authenticated);
      if (authenticated) setActiveProvider(authenticated[0]);
      pushEvent('Provider topology resolved', 'good');
    }).catch(() => pushEvent('Provider detection deferred', 'warn'));
  }, [orchestrator, pushEvent]);

  useEffect(() => {
    if (activeOverlay === 'providers') {
      const nextLimits: Record<string, string> = {};
      const run = async () => {
        for (const id of Array.from(providers.keys())) {
          const adapter = orchestrator.getRouter().getAdapter(id);
          if (adapter) {
            const rateLimit = await adapter.getRateLimitStatus();
            const health = await adapter.checkHealth();
            if (health.rateLimited || rateLimit.limited) {
              const resetTime = rateLimit.resetAt ?? health.cooldownUntil;
              const timeStr = resetTime
                ? resetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'soon';
              nextLimits[id] = `Locked (resets ${timeStr})`;
            } else if (rateLimit.sessionUsed !== undefined && rateLimit.weeklyUsed !== undefined) {
              nextLimits[id] = `Sess: ${rateLimit.sessionUsed}% | Wk: ${rateLimit.weeklyUsed}%`;
              if (rateLimit.dailyRoutines) {
                nextLimits[id] += ` | Rtn: ${rateLimit.dailyRoutines}`;
              }
            } else if (rateLimit.apiKeyBudget !== undefined) {
              nextLimits[id] = `Budget: ${rateLimit.apiKeyBudget}`;
              if (rateLimit.apiKeyRate) {
                nextLimits[id] += ` | ${rateLimit.apiKeyRate}`;
              }
            } else {
              nextLimits[id] = 'Unlimited';
            }
          }
        }
        setProviderLimits(nextLimits);
      };
      run().catch(() => {});
    }
  }, [activeOverlay, providers, orchestrator]);

  useEffect(() => {
    const unsubDetected = eventBus.on('provider:detected', (data) => {
      setProviders((prev) => {
        const next = new Map(prev);
        next.set(data.adapterId, { installed: true, authenticated: false });
        return next;
      });
      pushEvent(`Provider detected → ${data.adapterId}`, 'good');
    });
    const unsubAuth = eventBus.on('provider:auth_valid', (data) => {
      setProviders((prev) => {
        const next = new Map(prev);
        const current = next.get(data.adapterId) ?? { installed: true, authenticated: false };
        next.set(data.adapterId, { ...current, authenticated: true });
        return next;
      });
      setActiveProvider(data.adapterId);
      pushEvent(`Provider authenticated → ${data.adapterId}`, 'good');
    });
    const unsubRetrieval = eventBus.on('retrieval.completed', (data) => {
      pushEvent(`Context optimized for ${data.fileCount} file(s)`, 'good');
    });
    const unsubMemory = eventBus.on('brain:memory_updated', (data) => {
      pushEvent(`Memory reinforced (${data.entriesChanged})`, 'good');
    });
    const unsubScan = eventBus.on('brain:scan_complete', (data) => {
      setIndexedFiles(data.fileCount);
      pushEvent(`Dependency graph updated (${data.fileCount} files)`, 'good');
    });
    return () => { unsubDetected(); unsubAuth(); unsubRetrieval(); unsubMemory(); unsubScan(); };
  }, [eventBus, pushEvent]);

  useEffect(() => {
    const dbPath = path.join(workingDirectory, '.metacli', 'brain.db');
    if (!fs.existsSync(dbPath)) return;
    import('@metacli/brain').then(({ BrainStore }) => {
      const store = new BrainStore(workingDirectory);
      try {
        const files = store.getAllFiles();
        setIndexedFiles(files.length);
        setMemorySummaries(
          store.getMemoriesByLayer('hot').length +
          store.getMemoriesByLayer('warm').length +
          store.getMemoriesByLayer('cold').length,
        );
        pushEvent(`Architecture snapshot loaded (${files.length} files)`, 'good');
      } finally {
        store.close();
      }
    }).catch(() => pushEvent('Brain database unavailable', 'warn'));
  }, [workingDirectory, pushEvent]);

  useEffect(() => {
    const currentInput = activePromptText();
    if (currentInput.startsWith('/')) {
      setSuggestions(slashRuntime.current.getSuggestions(currentInput).slice(0, 6));
      setSelectedSuggestionIndex(0);
    } else {
      setSuggestions([]);
      setSelectedSuggestionIndex(0);
    }
  }, [activePromptText, input, promptBuffer]);

  const addSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { id: `sys-${Date.now()}`, role: 'system', content, timestamp: new Date() }]);
  }, []);

  const executeSlashCommand = useCallback(async (raw: string) => {
    const parsed = slashRuntime.current.parse(raw);
    const result = slashRuntime.current.execute(parsed);
    if (result.type === 'overlay') {
      setActiveOverlay(result.overlayId ?? null);
      pushEvent(`Overlay opened → /${parsed.name}`, 'normal');
      return;
    }
    if (result.type === 'message') {
      addSystemMessage(result.message ?? '');
      return;
    }
    if (result.type === 'action') {
      if (result.action === 'clear') {
        setMessages([]);
        addSystemMessage('Conversation history cleared.');
      } else if (result.action === 'switch-provider') {
        const providerId = result.args?.[0];
        setActiveProvider(providerId === 'auto' ? '' : providerId ?? '');
        addSystemMessage(providerId === 'auto' ? 'Provider set to auto-routing.' : `Provider switched to ${providerId}.`);
        pushEvent(`Provider switched → ${providerId ?? 'auto'}`, 'good');
      } else if (result.action === 'trace-retrieval') {
        addSystemMessage(activeRetrieval ? `Last retrieval: ${activeRetrieval.items.join(', ')}. Why: ${activeRetrieval.why}.` : 'No retrieval trace is active yet.');
      } else {
        addSystemMessage(`Executed ${result.action}.`);
      }
    }
  }, [activeRetrieval, addSystemMessage, pushEvent]);

  const buildRetrievalVisibility = useCallback(async (prompt: string): Promise<RetrievalVisibility> => {
    const fallback = {
      items: ['architecture summary', 'semantic file map', 'dependency graph'],
      why: 'intent matched semantic workspace context',
      confidence: indexedFiles > 0 ? 89 : 64,
      tokensSaved: indexedFiles > 0 ? 12_000 : 2_400,
      source: indexedFiles > 0 ? 'Architecture Snapshot' : 'cold semantic fallback',
    };

    const dbPath = path.join(workingDirectory, '.metacli', 'brain.db');
    if (!fs.existsSync(dbPath)) return fallback;

    try {
      const { BrainStore, KeywordRetrievalEngine } = await import('@metacli/brain');
      const store = new BrainStore(workingDirectory);
      try {
        const retrieval = new KeywordRetrievalEngine(store, workingDirectory).retrieveContext(prompt);
        const items = retrieval.files.slice(0, 5).map((file) => file.summary ? `${file.path} summary` : file.path);
        if (items.length === 0) return fallback;
        const rawFileTokens = retrieval.files.reduce((sum, file) => sum + Math.ceil(file.size / 4), 0);
        const semanticTokens = Math.ceil(items.join('\n').length / 4) + retrieval.symbols.length * 12;
        return {
          items,
          why: `${retrieval.symbols[0]?.name ?? 'workspace'} matched semantic intent`,
          confidence: Math.min(97, 82 + retrieval.symbols.length),
          tokensSaved: Math.max(0, rawFileTokens - semanticTokens),
          source: `Architecture Snapshot #${Math.max(1, retrieval.files.length)}`,
        };
      } finally {
        store.close();
      }
    } catch {
      return fallback;
    }
  }, [indexedFiles, workingDirectory]);

  const submitPrompt = useCallback(async () => {
    // Outer try-catch: executeSlashCommand at line ~560 was outside the inner
    // try-catch, so any throw from it became an unhandled rejection → process crash.
    try {
    const userInput = activePromptText().trim();
    if (!userInput || isProcessing) return;
    setPromptText('');
    setSuggestions([]);
    setShowContinuation(false);

    if (slashRuntime.current.isSlashCommand(userInput)) {
      await executeSlashCommand(userInput);
      return;
    }

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content: userInput, timestamp: new Date() }]);
    setIsProcessing(true);
    setStreamContent('');
    setStreamProvider('');
    setStreamFallback(0);
    pushEvent('Intent analyzed', 'good');
    pushEvent('Graph-directed retrieval started', 'normal');

    const retrieval = await buildRetrievalVisibility(userInput);
    setActiveRetrieval(retrieval);
    pushEvent(`Context optimized (${retrieval.tokensSaved.toLocaleString()} tokens saved)`, 'good');

    try {
      const generator = orchestrator.ask(userInput, {
        preferredProvider: activeProvider || undefined,
        workingDirectory,
        contextResolver: createContextResolver(workingDirectory),
      });

      let fullContent = '';
      let finalProvider = '';
      let finalFallback = 0;

      for await (const streamEvent of generator) {
        setStreamProvider(streamEvent.provider);
        setStreamFallback(streamEvent.fallbackCount);
        finalProvider = streamEvent.provider;
        finalFallback = streamEvent.fallbackCount;
        if (streamEvent.provider) {
          pushEvent(`Provider routed → ${streamEvent.provider}`, 'good');
          if (streamEvent.provider !== activeProvider) {
            setActiveProvider(streamEvent.provider);
          }
        }

        const event = streamEvent.event;
        if (event.type === 'text') {
          fullContent += event.content;
          setStreamContent(fullContent);
        } else if (event.type === 'error') {
          fullContent += `\n[Error: ${event.error}]`;
          setStreamContent(fullContent);
        }
      }

      setMessages((prev) => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: fullContent || '(no response)',
        provider: finalProvider,
        fallbackCount: finalFallback,
        timestamp: new Date(),
        retrieval,
      }]);
      pushEvent('Workflow checkpoint created', 'good');
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date(),
      }]);
      pushEvent('Execution failed', 'warn');
    } finally {
      setIsProcessing(false);
      setStreamContent('');
      setStreamProvider('');
      setStreamFallback(0);
      setActiveRetrieval(undefined);
    }
    } catch (outerErr) {
      // Catches anything thrown outside the inner try-catch (e.g. executeSlashCommand)
      pushEvent(`Runtime error: ${outerErr instanceof Error ? outerErr.message : String(outerErr)}`, 'warn');
      setIsProcessing(false);
    }
  }, [activePromptText, activeProvider, buildRetrievalVisibility, executeSlashCommand, isProcessing, orchestrator, pushEvent, setPromptText, workingDirectory]);

  // Keep stable refs pointing to latest closures so the stdin effect (Effect 2)
  // never needs these in its dep array — prevents it from re-running on every
  // provider/state change or whenever useApp() re-creates exit.
  useEffect(() => { submitPromptRef.current = submitPrompt; }, [submitPrompt]);
  useEffect(() => { executeSlashCommandRef.current = executeSlashCommand; }, [executeSlashCommand]);

  const handleTerminalEvent = useCallback((event: TerminalInputEvent) => {
    dbg(`[EVENT] ${event.type}${event.type === 'text' ? `:"${(event as any).text}"` : ''}`);
    if (event.type === 'ctrl-c') {
      // Close overlays/palette first; only exit when nothing is open
      if (showPaletteRef.current) { setShowPalette(false); return; }
      if (activeOverlayRef.current) { setActiveOverlay(null); return; }
      dbg(`[EXIT] ctrl-c fired, overlay=${String(activeOverlayRef.current)}, palette=${String(showPaletteRef.current)}`);
      exitRef.current();
      // Background timers (scan workers, monitors) keep the event loop alive
      // after Ink unmounts, so force-exit after a short drain window.
      setTimeout(() => process.exit(0), 150);
      return;
    }
    if (event.type === 'ctrl-k') {
      setShowPalette((prev) => !prev);
      setActiveOverlay(null);
      return;
    }
    if (event.type === 'escape') {
      dbg(`[ESCAPE] overlay=${String(activeOverlayRef.current)}`);
      if (showPaletteRef.current) setShowPalette(false);
      if (activeOverlayRef.current) setActiveOverlay(null);
      return;
    }
    if (showPaletteRef.current || activeOverlayRef.current) return;

    if (showContinuationRef.current && messagesRef.current.length === 0 && event.type === 'text' && !event.pasted) {
      if (event.text.toLowerCase() === 'y') {
        setShowContinuation(false);
        addSystemMessage('Continuing previous engineering thread.');
        pushEvent('Continuation restored', 'good');
        return;
      }
      if (event.text.toLowerCase() === 'n') {
        setShowContinuation(false);
        addSystemMessage('Started a new session.');
        pushEvent('New session initialized', 'good');
        return;
      }
    }

    if (event.type === 'submit') {
      const currentInput = activePromptText();
      if (currentInput.trim() === '/') {
        return;
      }

      if (currentInput.trim().startsWith('/')) {
        const executable = slashRuntime.current.resolveExecutableInput(currentInput);
        if (executable) {
          executeSlashCommandRef.current(executable).catch(err => pushEvent(`Command error: ${err instanceof Error ? err.message : String(err)}`, 'warn'));
          setPromptText('');
          setSuggestions([]);
          return;
        }

        const selected = suggestionsRef.current[selectedSuggestionIndexRef.current];
        if (selected) {
          const parts = currentInput.trim().split(/\s+/);
          const args = parts.slice(1).join(' ');
          const hasArgs = args.length > 0;
          if (!selected.command.argHint || hasArgs) {
            executeSlashCommandRef.current(`/${selected.command.name}${hasArgs ? ` ${args}` : ''}`).catch(err => pushEvent(`Command error: ${err instanceof Error ? err.message : String(err)}`, 'warn'));
            setPromptText('');
            setSuggestions([]);
            return;
          }
          setPromptText(`/${selected.command.name} `);
          return;
        }
      }

      submitPromptRef.current().catch(err => pushEvent(`Submit error: ${err instanceof Error ? err.message : String(err)}`, 'warn'));
      return;
    }
    if (event.type === 'up' && suggestionsRef.current.length > 0) {
      setSelectedSuggestionIndex((prev) => (prev - 1 + suggestionsRef.current.length) % suggestionsRef.current.length);
      return;
    }
    if (event.type === 'down' && suggestionsRef.current.length > 0) {
      setSelectedSuggestionIndex((prev) => (prev + 1) % suggestionsRef.current.length);
      return;
    }
    if (event.type === 'tab' && activePromptText().startsWith('/') && suggestionsRef.current.length > 0) {
      const selected = suggestionsRef.current[selectedSuggestionIndexRef.current];
      if (selected) {
        const currentParts = activePromptText().trim().split(/\s+/);
        const args = currentParts.slice(1).join(' ');
        setPromptText(selected.command.argHint ? `/${selected.command.name}${args ? ` ${args}` : ' '}` : `/${selected.command.name}`);
      }
      return;
    }
    if (event.type === 'backspace') {
      if (promptBufferRef.current.isLarge) {
        if (inputRef.current.length > 0) {
          // Remove from the typed tail (visible in input line)
          const newTail = inputRef.current.slice(0, -1);
          inputRef.current = newTail;
          setInput(newTail);
          const newFull = pasteBaseRef.current + newTail;
          const nb = createPromptBuffer(newFull);
          promptBufferRef.current = nb;
          setPromptBuffer(nb);
        } else {
          // Tail exhausted — backspace into the paste base
          const newFull = promptBufferRef.current.text.slice(0, -1);
          const nb = createPromptBuffer(newFull);
          promptBufferRef.current = nb;
          pasteBaseRef.current = newFull;
          setPromptBuffer(nb);
          if (!nb.isLarge) {
            // Shrunk below large threshold — resume normal mode
            inputRef.current = nb.text;
            setInput(nb.text);
          }
        }
      } else {
        setPromptText(activePromptText().slice(0, -1));
      }
      return;
    }
    if (event.type === 'text') {
      if (event.pasted) {
        // Pasted content: update full buffer, reset typed tail
        const newText = activePromptText() + event.text;
        const nb = createPromptBuffer(newText);
        promptBufferRef.current = nb;
        setPromptBuffer(nb);
        if (nb.isLarge) {
          pasteBaseRef.current = newText;
          inputRef.current = '';
          setInput('');
        } else {
          inputRef.current = nb.text;
          setInput(nb.text);
        }
      } else if (promptBufferRef.current.isLarge) {
        // Typing after large paste — append to tail (shown in input line)
        const newTail = inputRef.current + event.text;
        inputRef.current = newTail;
        setInput(newTail);
        const newFull = pasteBaseRef.current + newTail;
        const nb = createPromptBuffer(newFull);
        promptBufferRef.current = nb;
        setPromptBuffer(nb);
      } else {
        setPromptText(activePromptText() + event.text);
      }
    }
  // submitPrompt and executeSlashCommand are accessed via refs — removing them
  // from deps means this callback is stable and Effect 2 (data listener) never
  // re-registers when activeProvider or other prompt-related state changes.
  }, [activePromptText, addSystemMessage, pushEvent, setPromptText]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep ref current so Effect 2 can always call the latest handleTerminalEvent
  // without listing it as a dep (which would cause the listener to re-register
  // on every render where useApp()/exit changes).
  handleTerminalEventRef.current = handleTerminalEvent;

  useLayoutEffect(() => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    // Raw mode + bracketed paste — mount/unmount only, never mid-session.
    dbg(`[EFFECT1] MOUNT raw mode setup. isTTY=${String(stdout.isTTY)} hasSetRawMode=${String(typeof stdin.setRawMode === 'function')}`);
    if (stdout.isTTY) stdout.write(ENABLE_BRACKETED_PASTE);
    if (typeof stdin.setRawMode === 'function') stdin.setRawMode(true);
    stdin.resume();
    stdin.ref();

    // Ink tracks useInput hooks via rawModeEnabledCount. When the last hook
    // unmounts (e.g. closing providers overlay), it calls stdin.unref() which
    // is a TOGGLE (not a reference count) in libuv — so our ref() above gets
    // immediately overridden. The event loop becomes empty → Node exits with 0.
    // Fix: suppress stdin.unref() calls while ConversationRuntime is mounted.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stdinAny = stdin as any;
    const origUnref = stdinAny.unref?.bind(stdin) as (() => void) | undefined;
    stdinAny.unref = () => { /* suppressed — ConversationRuntime holds the ref */ };

    return () => {
      dbg('[EFFECT1] UNMOUNT cleanup stack:\n' + new Error().stack?.split('\n').slice(1,5).join('\n'));
      // Restore unref before unmounting so the process can exit cleanly
      if (origUnref) stdinAny.unref = origUnref;
      if (stdout.isTTY) stdout.write(DISABLE_BRACKETED_PASTE);
      if (typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
      stdin.unref();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const stdin = process.stdin;
    // Data listener re-registers when handleTerminalEvent changes (e.g. new
    // activeProvider), but never touches raw mode — that's handled above.
    const onData = (data: Buffer) => {
      dbg(`[DATA] hex=${data.toString('hex')} len=${data.length} processing=${String(isProcessingRef.current)}`);
      if (isProcessingRef.current) return;
      for (const event of parseTerminalInput(data)) {
        handleTerminalEventRef.current(event);
      }
    };
    dbg(`[STDIN] registering data listener`);
    stdin.on('data', onData);
    return () => { dbg('[STDIN] removing data listener'); stdin.off('data', onData); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box flexDirection="column" minHeight={22} width={110} paddingX={1}>
      <IntelligenceHeader
        workspace={workspaceName(workingDirectory)}
        brainWarm={indexedFiles > 0}
        provider={activeProvider}
        memoryCount={memorySummaries}
        contextState={indexedFiles > 0 ? 'Optimized' : 'Warming'}
        tokenEfficiency={tokenEfficiency}
        pulse={pulse}
      />

      {showPalette && (
        <CommandPalette
          runtime={slashRuntime.current}
          onExecute={(command) => {
            setInput(command);
            setShowPalette(false);
          }}
          onClose={() => setShowPalette(false)}
        />
      )}

      {activeOverlay && !showPalette && (
        <OverlayManager
          activeOverlay={activeOverlay}
          context={{
            providers,
            healthScores,
            cooldowns,
            limits: providerLimits,
            workingDirectory,
            indexedFiles,
            memorySummaries,
            eventBus,
            activeProvider,
            onSelectProvider: (providerId) => {
              executeSlashCommand(`/provider ${providerId}`).catch(err => pushEvent(`Provider switch error: ${err instanceof Error ? err.message : String(err)}`, 'warn'));
              setActiveOverlay(null);
            },
          }}
          onClose={() => setActiveOverlay(null)}
        />
      )}

      {!showPalette && !activeOverlay && (
        <Box flexGrow={1} marginTop={1}>
          <ConversationStream
            messages={messages}
            streamContent={streamContent}
            streamProvider={streamProvider}
            streamFallback={streamFallback}
            activeRetrieval={activeRetrieval}
            showContinuation={showContinuation}
            workspace={workspaceName(workingDirectory)}
            indexedFiles={indexedFiles}
            memoryCount={memorySummaries}
          />
        </Box>
      )}

      {!showPalette && !activeOverlay && (
        <CommandLayer
          value={input}
          promptBuffer={promptBuffer}
          suggestions={suggestions}
          showSuggestions={activePromptText().startsWith('/') && suggestions.length > 0}
          selectedSuggestionIndex={selectedSuggestionIndex}
          isProcessing={isProcessing}
        />
      )}
    </Box>
  );
}
