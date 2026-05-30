/**
 * MetaCLI — Overlay Manager
 *
 * Manages the active overlay panel. Renders the overlay above the conversation.
 * Handles ESC to close. Lightweight, non-blocking.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ProvidersOverlay } from './overlays/ProvidersOverlay.js';
import { BrainOverlay } from './overlays/BrainOverlay.js';
import { UsageOverlay } from './overlays/UsageOverlay.js';
import { HelpOverlay } from './overlays/HelpOverlay.js';
import { SessionsOverlay } from './overlays/SessionsOverlay.js';
import { MemoryOverlay } from './overlays/MemoryOverlay.js';
import { GraphOverlay } from './overlays/GraphOverlay.js';
import { MapOverlay } from './overlays/MapOverlay.js';
import { TimelineOverlay } from './overlays/TimelineOverlay.js';
import { ContextOverlay } from './overlays/ContextOverlay.js';
import { TelemetryOverlay } from './overlays/TelemetryOverlay.js';
import { WorkflowsOverlay } from './overlays/WorkflowsOverlay.js';
import { ReplayOverlay } from './overlays/ReplayOverlay.js';
import { EventsOverlay } from './overlays/EventsOverlay.js';
import { LogsOverlay } from './overlays/LogsOverlay.js';
import { SettingsOverlay } from './overlays/SettingsOverlay.js';
import type { OverlayId } from '../runtime/SlashCommandRuntime.js';

export interface OverlayContext {
  providers: Map<string, { installed: boolean; authenticated: boolean }>;
  healthScores: Record<string, number>;
  cooldowns: Record<string, string>;
  limits?: Record<string, string>;
  workingDirectory: string;
  indexedFiles: number;
  memorySummaries: number;
  eventBus?: any;
  activeProvider?: string;
  onSelectProvider?: (providerId: string) => void;
}

interface OverlayManagerProps {
  activeOverlay: OverlayId;
  context: OverlayContext;
  onClose: () => void;
}

const OVERLAY_TITLES: Partial<Record<NonNullable<OverlayId>, string>> = {
  providers: 'Provider Status',
  brain: 'Project Brain',
  usage: 'Usage & Tokens',
  sessions: 'Session Timeline',
  memory: 'Memory Inspector',
  graph: 'Architecture Graph',
  map: 'Repository Topology',
  timeline: 'Project Evolution',
  context: 'Retrieval Context',
  telemetry: 'Telemetry',
  workflows: 'Workflows',
  replay: 'Session Replay',
  help: 'Slash Commands',
  settings: 'Settings',
  events: 'Event Stream',
  logs: 'System Logs',
};

function PlaceholderOverlay({ id }: { id: string }): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>{OVERLAY_TITLES[id as NonNullable<OverlayId>] ?? id}</Text>
        <Text color="gray">  •  ESC to close</Text>
      </Box>
      <Box paddingLeft={2} flexDirection="column" gap={1}>
        <Text color="gray">This overlay is coming soon.</Text>
        <Text color="gray" dimColor>Run /reindex to populate data, then try again.</Text>
      </Box>
    </Box>
  );
}

export function OverlayManager({ activeOverlay, context, onClose }: OverlayManagerProps): React.ReactElement | null {
  // ESC and Ctrl+C are handled by ConversationRuntime's raw stdin handler.
  // A duplicate useInput here was causing Ctrl+C to fire onClose() and exit()
  // simultaneously, closing the app instead of just dismissing the overlay.
  if (!activeOverlay) return null;

  const renderOverlay = () => {
    switch (activeOverlay) {
      case 'providers':
        return (
          <ProvidersOverlay
            providers={context.providers}
            healthScores={context.healthScores}
            cooldowns={context.cooldowns}
            limits={context.limits}
            activeProvider={context.activeProvider ?? ''}
            onSelectProvider={context.onSelectProvider}
          />
        );

      case 'brain':
        return (
          <BrainOverlay
            workingDirectory={context.workingDirectory}
            indexedFiles={context.indexedFiles}
            memorySummaries={context.memorySummaries}
          />
        );

      case 'usage':
        return <UsageOverlay />;

      case 'help':
        return <HelpOverlay />;

      case 'sessions':
        return <SessionsOverlay />;

      case 'memory':
        return <MemoryOverlay workingDirectory={context.workingDirectory} />;

      case 'graph':
        return <GraphOverlay workingDirectory={context.workingDirectory} />;

      case 'map':
        return <MapOverlay workingDirectory={context.workingDirectory} />;

      case 'timeline':
        return <TimelineOverlay workingDirectory={context.workingDirectory} />;

      case 'context':
        return <ContextOverlay />;

      case 'telemetry':
        return <TelemetryOverlay />;

      case 'workflows':
        return <WorkflowsOverlay />;

      case 'replay':
        return <ReplayOverlay />;

      case 'events':
        return <EventsOverlay eventBus={context.eventBus} />;

      case 'logs':
        return <LogsOverlay />;

      case 'settings':
        return <SettingsOverlay />;

      default:
        return <PlaceholderOverlay id={activeOverlay} />;
    }
  };

  return (
    <Box
      flexDirection="column"
      paddingX={2}
      paddingY={0}
      marginBottom={1}
    >
      <Text color="gray" dimColor>{'─'.repeat(78)}</Text>
      {renderOverlay()}
      <Text color="gray" dimColor>{'─'.repeat(78)}</Text>
    </Box>
  );
}
