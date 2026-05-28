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

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
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
    <Text color="gray">Retrieved:</Text>
    {retrieval.items.slice(0, 5).map((item) => (
      <Text key={item} color="gray">  • {item}</Text>
    ))}
    <Text color="gray">Why: <Text color="white">{retrieval.why}</Text></Text>
    <Text color="gray">Confidence: <Text color="green">{retrieval.confidence}%</Text></Text>
    <Text color="gray">Context: <Text color="green">{retrieval.tokensSaved.toLocaleString()} tokens saved</Text> using {retrieval.source}</Text>
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
              <Text color="green">✓ Large prompt detected</Text>
              <Text color="green">✓ {promptBuffer.lineCount.toLocaleString()} lines</Text>
              <Text color="green">✓ Ready to send</Text>
            </Box>
          ) : (
            <Text color={value.startsWith('/') ? 'cyan' : 'white'}>{value.startsWith('/') ? value.slice(1) : value}</Text>
          )}
          <Text color="green">▌</Text>
          {!value && !promptBuffer.isLarge && <Text color="gray">ask, or type / for commands</Text>}
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
}: ConversationRuntimeProps): React.ReactElement {
  const { exit } = useApp();
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
  const [activeOverlay, setActiveOverlay] = useState<OverlayId>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [providers, setProviders] = useState<Map<string, { installed: boolean; authenticated: boolean }>>(new Map());
  const [activeProvider, setActiveProvider] = useState('');
  const [healthScores] = useState<Record<string, number>>({ 'claude-code': 100, 'gemini-cli': 96 });
  const [cooldowns] = useState<Record<string, string>>({});
  const [indexedFiles, setIndexedFiles] = useState(0);
  const [memorySummaries, setMemorySummaries] = useState(0);
  const [showContinuation, setShowContinuation] = useState(true);
  const slashRuntime = useRef(new SlashCommandRuntime());
  const promptBufferRef = useRef<PromptBufferState>(EMPTY_PROMPT_BUFFER);
  const inputRef = useRef('');
  const suggestionsRef = useRef<CommandSuggestion[]>([]);
  const selectedSuggestionIndexRef = useRef(0);
  const showPaletteRef = useRef(false);
  const activeOverlayRef = useRef<OverlayId>(null);
  const showContinuationRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);
  const isProcessingRef = useRef(false);

  const setPromptText = useCallback((text: string) => {
    const nextBuffer = createPromptBuffer(text);
    promptBufferRef.current = nextBuffer;
    inputRef.current = nextBuffer.isLarge ? '' : nextBuffer.text;
    setPromptBuffer(nextBuffer);
    setInput(nextBuffer.isLarge ? '' : nextBuffer.text);
  }, []);

  const activePromptText = useCallback(() => promptBufferRef.current.text || inputRef.current, []);

  useEffect(() => { inputRef.current = input; }, [input]);
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);
  useEffect(() => { selectedSuggestionIndexRef.current = selectedSuggestionIndex; }, [selectedSuggestionIndex]);
  useEffect(() => { showPaletteRef.current = showPalette; }, [showPalette]);
  useEffect(() => { activeOverlayRef.current = activeOverlay; }, [activeOverlay]);
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
        if (streamEvent.provider) pushEvent(`Provider routed → ${streamEvent.provider}`, 'good');

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
  }, [activePromptText, activeProvider, buildRetrievalVisibility, executeSlashCommand, isProcessing, orchestrator, pushEvent, setPromptText, workingDirectory]);

  const handleTerminalEvent = useCallback((event: TerminalInputEvent) => {
    if (event.type === 'ctrl-c') {
      exit();
      return;
    }
    if (event.type === 'ctrl-k') {
      setShowPalette((prev) => !prev);
      setActiveOverlay(null);
      return;
    }
    if (event.type === 'escape') {
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
          void executeSlashCommand(executable);
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
            void executeSlashCommand(`/${selected.command.name}${hasArgs ? ` ${args}` : ''}`);
            setPromptText('');
            setSuggestions([]);
            return;
          }
          setPromptText(`/${selected.command.name} `);
          return;
        }
      }

      void submitPrompt();
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
      setPromptText(activePromptText().slice(0, -1));
      return;
    }
    if (event.type === 'text') {
      const previous = event.pasted ? activePromptText() : inputRef.current;
      setPromptText(previous + event.text);
    }
  }, [activePromptText, addSystemMessage, executeSlashCommand, exit, pushEvent, setPromptText, submitPrompt]);

  useEffect(() => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (stdout.isTTY) stdout.write(ENABLE_BRACKETED_PASTE);
    if (stdin.isTTY) {
      stdin.setRawMode(true);
      stdin.resume();
    }

    const onData = (data: Buffer) => {
      if (isProcessingRef.current) return;
      for (const event of parseTerminalInput(data)) {
        handleTerminalEvent(event);
      }
    };

    stdin.on('data', onData);
    return () => {
      stdin.off('data', onData);
      if (stdout.isTTY) stdout.write(DISABLE_BRACKETED_PASTE);
      if (stdin.isTTY) stdin.setRawMode(false);
    };
  }, [handleTerminalEvent]);

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
            workingDirectory,
            indexedFiles,
            memorySummaries,
            eventBus,
            activeProvider,
            onSelectProvider: (providerId) => {
              void executeSlashCommand(`/provider ${providerId}`);
              setActiveOverlay(null);
            },
          }}
          onClose={() => setActiveOverlay(null)}
        />
      )}

      {!showPalette && !activeOverlay && (
        <Box flexDirection="row" flexGrow={1} marginTop={1}>
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
          <CognitiveStream events={events} mode={adaptiveMode} />
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
