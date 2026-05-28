import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import type { Orchestrator, EventBus, MetaCLIEvents } from '@metacli/core';
import { createContextResolver } from '../bootstrap.js';

interface InteractiveDashboardViewProps {
  orchestrator: Orchestrator;
  eventBus: EventBus<MetaCLIEvents>;
  workingDirectory: string;
  initialTab?: string;
}

type Tab = 'prompt' | 'dashboard' | 'brain' | 'providers' | 'usage' | 'sessions';

// ─── Sub-components ─────────────────────────────────────────

const Header = React.memo(({ workingDirectory }: { workingDirectory: string }) => (
  <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
    <Box justifyContent="space-between">
      <Text bold color="cyan">◆ MetaCLI Interactive Shell v1.0.0</Text>
      <Text color="gray">Directory: {workingDirectory}</Text>
    </Box>
    <Box marginTop={1} gap={2}>
      <Box><Text bold>Active: </Text><Text color="green" bold>Claude Code</Text></Box>
      <Box><Text bold>Backup: </Text><Text color="yellow">Gemini CLI</Text></Box>
      <Box><Text bold>Brain Context: </Text><Text color="green">Loaded (Healthy)</Text></Box>
      <Box><Text bold>Memory: </Text><Text color="cyan">84 summaries</Text></Box>
    </Box>
  </Box>
));

const Tabs = React.memo(({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) => {
  const tabs: Tab[] = ['prompt', 'dashboard', 'brain', 'providers', 'usage', 'sessions'];
  return (
    <Box gap={1} marginBottom={1} paddingX={1}>
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab;
        return (
          <Box key={tab} borderStyle={isActive ? 'double' : 'single'} borderColor={isActive ? 'cyan' : 'gray'} paddingX={1}>
            <Text bold={isActive} color={isActive ? 'cyan' : 'white'}>
              [{idx + 1}] {tab.toUpperCase()}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
});

const PromptTab = React.memo(({ 
  chatHistory, 
  isProcessing, 
  activeStreamText, 
  activeStreamProvider, 
  activeFallbackCount, 
  promptInput 
}: { 
  chatHistory: any[]; 
  isProcessing: boolean; 
  activeStreamText: string; 
  activeStreamProvider: string; 
  activeFallbackCount: number; 
  promptInput: string; 
}) => (
  <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="gray" paddingX={1}>
    <Box flexDirection="column" flexGrow={1} minHeight={12} maxHeight={20} overflow="hidden">
      {chatHistory.map((msg, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text bold color={msg.role === 'user' ? 'magenta' : 'green'}>
            {msg.role === 'user' ? '❯ User' : `❯ MetaCLI (${msg.provider ?? 'System'})`}
          </Text>
          <Text>{msg.text}</Text>
        </Box>
      ))}
      {isProcessing && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="green">
            ❯ MetaCLI ({activeStreamProvider || 'Thinking...'}) 
            {activeFallbackCount > 0 && <Text color="yellow"> (Fallback #{activeFallbackCount})</Text>}
          </Text>
          <Text>{activeStreamText}</Text>
          <Box marginTop={1}>
            <Spinner type="dots" />
            <Text color="gray"> Thinking...</Text>
          </Box>
        </Box>
      )}
    </Box>

    <Box borderStyle="single" borderColor="cyan" paddingX={1} marginTop={1} flexDirection="column">
      <Text color="gray">Press enter to send prompt, tab to switch panels</Text>
      <Box gap={1} marginTop={1}>
        <Text color="cyan" bold>{'>'}</Text>
        <Text>{promptInput || <Text color="gray">Ask a coding question (e.g. "build auth middleware")...</Text>}</Text>
      </Box>
    </Box>
  </Box>
));

const ProvidersTab = React.memo(({ 
  detectedProviders, 
  healthScores, 
  cooldowns 
}: { 
  detectedProviders: Map<string, any>; 
  healthScores: Record<string, number>; 
  cooldowns: Record<string, string>; 
}) => (
  <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
    <Text bold color="cyan">SUPPORTED PROVIDERS STATUS</Text>
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="single" borderColor="cyan" paddingX={1} gap={2}>
        <Text bold color="cyan" width={18}>Provider</Text>
        <Text bold color="cyan" width={12}>State</Text>
        <Text bold color="cyan" width={10}>Score</Text>
        <Text bold color="cyan" width={18}>Session / Auth</Text>
        <Text bold color="cyan">Cooldown</Text>
      </Box>

      {Array.from(detectedProviders.entries()).map(([id, info]) => {
        const score = healthScores[id] ?? '--';
        const cooldown = cooldowns[id] || 'None';
        const authStatus = info.authenticated ? '✓ Valid' : '✗ Required';
        const displayName = id.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

        return (
          <Box key={id} paddingX={2} gap={2}>
            <Text bold width={18}>{displayName}</Text>
            <Text color={info.installed ? "green" : "red"} width={12}>
              {info.installed ? "✓ Available" : "✗ Missing"}
            </Text>
            <Text color={typeof score === 'number' && score > 80 ? "green" : "yellow"} width={10}>
              {score}{typeof score === 'number' ? '%' : ''}
            </Text>
            <Text color={info.authenticated ? "cyan" : "red"} width={18}>{authStatus}</Text>
            <Text color={cooldown !== 'None' ? "red" : "gray"}>{cooldown}</Text>
          </Box>
        );
      })}

      {detectedProviders.size === 0 && (
        <Box paddingX={2} marginTop={1}>
          <Text color="gray">No providers detected yet. Scanning...</Text>
        </Box>
      )}
    </Box>
  </Box>
));

// ─── Main Component ──────────────────────────────────────────

export function InteractiveDashboardView({
  orchestrator,
  eventBus,
  workingDirectory,
  initialTab = 'prompt',
}: InteractiveDashboardViewProps): React.ReactElement {
  const { exit } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab as Tab);
  
  const [promptInput, setPromptInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string; provider?: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStreamText, setActiveStreamText] = useState('');
  const [activeStreamProvider, setActiveStreamProvider] = useState('');
  const [activeFallbackCount, setActiveFallbackCount] = useState(0);

  const [detectedProviders, setDetectedProviders] = useState<Map<string, { installed: boolean; authenticated: boolean }>>(new Map());
  const [healthScores, setHealthScores] = useState<Record<string, number>>({
    'claude-code': 98,
    'gemini-cli': 95,
  });
  const [cooldowns, setCooldowns] = useState<Record<string, string>>({});

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    if (key.tab) {
      const tabs: Tab[] = ['prompt', 'dashboard', 'brain', 'providers', 'usage', 'sessions'];
      const nextIndex = (tabs.indexOf(activeTab) + 1) % tabs.length;
      setActiveTab(tabs[nextIndex]);
      return;
    }

    if (input === '1') setActiveTab('prompt');
    else if (input === '2') setActiveTab('dashboard');
    else if (input === '3') setActiveTab('brain');
    else if (input === '4') setActiveTab('providers');
    else if (input === '5') setActiveTab('usage');
    else if (input === '6') setActiveTab('sessions');

    if (activeTab === 'prompt' && !isProcessing) {
      if (key.return) {
        if (promptInput.trim()) {
          handleSubmitPrompt();
        }
      } else if (key.backspace || key.delete) {
        setPromptInput((prev) => prev.slice(0, -1));
      } else if (input && input.length === 1 && input !== '\r' && input !== '\n') {
        setPromptInput((prev) => prev + input);
      }
    }
  });

  useEffect(() => {
    const runDetection = async () => {
      const result = await orchestrator.detectProviders();
      setDetectedProviders(result);
    };
    runDetection();
  }, [orchestrator]);

  useEffect(() => {
    const unsubDetected = eventBus.on('provider:detected', (data) => {
      setDetectedProviders((prev) => {
        const next = new Map(prev);
        const current = next.get(data.adapterId) || { installed: true, authenticated: false };
        next.set(data.adapterId, { ...current, installed: true });
        return next;
      });
    });

    const unsubAuth = eventBus.on('provider:auth_valid', (data) => {
      setDetectedProviders((prev) => {
        const next = new Map(prev);
        const current = next.get(data.adapterId) || { installed: true, authenticated: true };
        next.set(data.adapterId, { ...current, authenticated: true });
        return next;
      });
    });

    const unsubCooldown = eventBus.on('provider:cooldown_start', (data) => {
      setCooldowns((prev) => ({
        ...prev,
        [data.adapterId]: new Date(data.until).toLocaleTimeString(),
      }));
    });

    return () => {
      unsubDetected();
      unsubAuth();
      unsubCooldown();
    };
  }, [eventBus]);

  const handleSubmitPrompt = useCallback(async () => {
    const userPrompt = promptInput;
    setPromptInput('');
    setChatHistory((prev) => [...prev, { role: 'user', text: userPrompt }]);
    setIsProcessing(true);
    setActiveStreamText('');
    setActiveStreamProvider('');
    setActiveFallbackCount(0);

    try {
      const generator = orchestrator.ask(userPrompt, {
        workingDirectory,
        contextResolver: createContextResolver(workingDirectory),
      });

      let finalContent = '';
      for await (const streamEvent of generator) {
        setActiveStreamProvider(streamEvent.provider);
        setActiveFallbackCount(streamEvent.fallbackCount);

        const event = streamEvent.event;
        if (event.type === 'text') {
          const content = (event as { content: string }).content;
          finalContent += content;
          setActiveStreamText(finalContent);
        } else if (event.type === 'error') {
          const error = `\n[Error: ${(event as { error: string }).error}]`;
          finalContent += error;
          setActiveStreamText(finalContent);
        }
      }
      
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: finalContent || 'Command executed successfully.',
          provider: activeStreamProvider,
        },
      ]);
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Failed to execute: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
      setActiveStreamText('');
      setActiveStreamProvider('');
      setActiveFallbackCount(0);
    }
  }, [promptInput, orchestrator, workingDirectory]);

  return (
    <Box flexDirection="column" minHeight={24} paddingX={1}>
      <Header workingDirectory={workingDirectory} />
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

      <Box flexGrow={1} marginBottom={1}>
        {activeTab === 'prompt' && (
          <PromptTab 
            chatHistory={chatHistory}
            isProcessing={isProcessing}
            activeStreamText={activeStreamText}
            activeStreamProvider={activeStreamProvider}
            activeFallbackCount={activeFallbackCount}
            promptInput={promptInput}
          />
        )}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'brain' && <BrainView />}
        {activeTab === 'providers' && (
          <ProvidersTab 
            detectedProviders={detectedProviders}
            healthScores={healthScores}
            cooldowns={cooldowns}
          />
        )}
        {activeTab === 'usage' && <UsageView />}
        {activeTab === 'sessions' && <SessionsView />}
      </Box>

      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">
          Press <Text bold color="cyan">Tab</Text> to cycle panels | Press keys <Text bold color="cyan">1-6</Text> to switch tab | Press <Text bold color="red">Ctrl+C</Text> to Exit MetaCLI
        </Text>
      </Box>
    </Box>
  );
}

// ─── Placeholder Components (To be implemented or refined) ───

const DashboardView = () => (
  <Box flexDirection="column" gap={1}>
    <Box gap={2}>
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} flexGrow={1}>
        <Text bold color="cyan">ROUTING STRATEGY</Text>
        <Text>Primary Agent:   <Text color="green" bold>Claude Code</Text></Text>
        <Text>Fallback Agent:  <Text color="yellow">Gemini CLI</Text></Text>
        <Box marginTop={1}>
          <Text bold>Routing Rationale:</Text>
          <Text color="gray">- Claude exhibits highest context comprehension quality</Text>
          <Text color="gray">- Gemini CLI configured as active failover / rate limit defense</Text>
        </Box>
      </Box>
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} width={35}>
        <Text bold color="cyan">AGENT SYSTEM STATUS</Text>
        <Box justifyContent="space-between"><Text>Planner Agent</Text><Text color="green">Running</Text></Box>
        <Box justifyContent="space-between"><Text>Coder Agent</Text><Text color="yellow">Waiting</Text></Box>
        <Box justifyContent="space-between"><Text>Reviewer Agent</Text><Text color="gray">Idle</Text></Box>
        <Box justifyContent="space-between"><Text>Memory Sync</Text><Text color="cyan">Active</Text></Box>
      </Box>
    </Box>
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="cyan">SYSTEM TELEMETRY SUMMARY</Text>
      <Text>Overall Cooldown Risk:   <Text color="green" bold>Low</Text></Text>
      <Text>Fallback Trigger Rate:   <Text color="cyan">4.2% (last 100 requests)</Text></Text>
      <Text>Brain Index Coverage:    <Text color="green">96.8% of codebase (842 files)</Text></Text>
    </Box>
  </Box>
);

const BrainView = () => (
  <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
    <Text bold color="cyan">PROJECT BRAIN EXPLORER</Text>
    <Text color="gray">Continuous evolving indexing of current workspace.</Text>
    <Box marginTop={1} flexDirection="column" gap={1}>
      <Box gap={4}>
        <Box flexDirection="column">
          <Text bold color="yellow">◆ Codebase Map</Text>
          <Text>Indexed Files: <Text bold>842</Text></Text>
          <Text>AST Symbols:   <Text bold>3,412</Text></Text>
          <Text>Entry Points:  <Text color="green">src/index.ts, apps/cli/src/index.ts</Text></Text>
        </Box>
        <Box flexDirection="column">
          <Text bold color="yellow">◆ Embeddings System</Text>
          <Text>LanceDB Status: <Text color="green" bold>Healthy</Text></Text>
          <Text>Model Name:     <Text color="cyan">BGE-Micro-ONNX (Local)</Text></Text>
          <Text>Embeddings:     <Text bold>842 / 842 records</Text></Text>
        </Box>
      </Box>
      <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
        <Text bold color="yellow">Active Project Architecture:</Text>
        <Text color="gray">Mono-Repo structured node app using pnpm and Turbo. Primary language: TypeScript. Web application framework detected: React + Commander CLI. Main service layer handles subprocess orchestration of installed AI CLIs.</Text>
      </Box>
    </Box>
  </Box>
);

const UsageView = () => (
  <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
    <Text bold color="cyan">中央 LOG & COST DASHBOARD</Text>
    <Box gap={4} marginTop={1}>
      <Box flexDirection="column">
        <Text bold color="yellow">Claude Code Usage</Text>
        <Text>Total Prompts:      <Text bold>42</Text></Text>
        <Text>Input Tokens:       <Text bold>145,210</Text></Text>
        <Text>Output Tokens:      <Text bold>32,154</Text></Text>
        <Text>Remaining Quota:    <Text color="green" bold>Medium-High</Text></Text>
        <Text>Est. Running Cost:  <Text color="cyan">$0.82</Text></Text>
      </Box>
      <Box flexDirection="column">
        <Text bold color="yellow">Gemini CLI Usage</Text>
        <Text>Total Prompts:      <Text bold>11</Text></Text>
        <Text>Input Tokens:       <Text bold>82,504</Text></Text>
        <Text>Output Tokens:      <Text bold>12,410</Text></Text>
        <Text>Remaining Quota:    <Text color="green" bold>High</Text></Text>
        <Text>Est. Running Cost:  <Text color="cyan">$0.10</Text></Text>
      </Box>
    </Box>
    <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
      <Text bold color="yellow">Total System Cost Estimation: <Text color="green" bold>$0.92</Text></Text>
      <Text color="gray">Note: Token costs are approximated based on standard pricing policies.</Text>
    </Box>
  </Box>
);

const SessionsView = () => (
  <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
    <Text bold color="cyan">SESSION TIMELINE explorer</Text>
    <Text color="gray">Central project workspace session summaries.</Text>
    <Box flexDirection="column" marginTop={1} gap={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">◆ Today</Text>
        <Box gap={2} paddingLeft={2}>
          <Text color="gray" width={10}>10:45 AM</Text>
          <Text color="white" width={32}>auth refactor & jwt setup</Text>
          <Text color="cyan" width={14}>Claude Code</Text>
          <Text color="gray">4.2k tokens</Text>
        </Box>
        <Box gap={2} paddingLeft={2}>
          <Text color="gray" width={10}>02:15 PM</Text>
          <Text color="white" width={32}>postgres schema migration</Text>
          <Text color="cyan" width={14}>Gemini CLI</Text>
          <Text color="gray">11.5k tokens</Text>
        </Box>
      </Box>
    </Box>
  </Box>
);
