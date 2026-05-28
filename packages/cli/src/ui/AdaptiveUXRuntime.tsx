/**
 * MetaCLI CLI — Adaptive UX Runtime
 *
 * Dynamically switches the terminal layout based on the current engineering
 * mode. Subscribes to system events to derive mode automatically, or accepts
 * an explicit mode prop. Each mode renders a semantically tuned layout:
 * compact during debugging, expanded during architecture, minimal at idle.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import type { EventBus } from '@metacli/core';
import type { MetaCLIEvents } from '@metacli/core';

export type EngineeringMode = 'idle' | 'architecting' | 'debugging' | 'coding' | 'stress';

export interface AdaptiveUXProps {
  eventBus: EventBus<MetaCLIEvents>;
  initialMode?: EngineeringMode;
  onModeChange?: (mode: EngineeringMode) => void;
}

interface StatusLine { label: string; value: string; color: string }

export const AdaptiveUXRuntime: React.FC<AdaptiveUXProps> = ({
  eventBus,
  initialMode = 'idle',
  onModeChange,
}) => {
  const [mode, setMode] = useState<EngineeringMode>(initialMode);
  const [systemHealth, setSystemHealth] = useState(100);
  const [statusLines, setStatusLines] = useState<StatusLine[]>([]);
  const [activeProvider, setActiveProvider] = useState('—');

  const changeMode = (next: EngineeringMode) => {
    setMode(next);
    onModeChange?.(next);
  };

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(eventBus.on('prompt:start', ({ provider }) => {
      setActiveProvider(provider);
      changeMode('coding');
    }));

    unsubs.push(eventBus.on('prompt:complete', () => changeMode('idle')));
    unsubs.push(eventBus.on('prompt:error', () => changeMode('debugging')));

    unsubs.push(eventBus.on('workflow:start', () => changeMode('architecting')));
    unsubs.push(eventBus.on('workflow:complete', () => changeMode('idle')));

    unsubs.push(eventBus.on('brain:scan_start', () => changeMode('stress')));
    unsubs.push(eventBus.on('brain:scan_complete', ({ fileCount, symbolCount }) => {
      changeMode('idle');
      setStatusLines([
        { label: 'Files indexed', value: String(fileCount), color: 'green' },
        { label: 'Symbols', value: String(symbolCount), color: 'cyan' },
      ]);
    }));

    unsubs.push(eventBus.on('provider:unhealthy', ({ adapterId }) => {
      setSystemHealth(h => Math.max(0, h - 15));
      setStatusLines([{ label: 'Provider unhealthy', value: adapterId, color: 'red' }]);
    }));

    unsubs.push(eventBus.on('provider:healthy', ({ score }) => {
      setSystemHealth(Math.round(score));
    }));

    return () => unsubs.forEach(fn => fn());
  }, [eventBus]); // eslint-disable-line react-hooks/exhaustive-deps

  const healthColor = systemHealth >= 80 ? 'green' : systemHealth >= 50 ? 'yellow' : 'red';

  const content = useMemo(() => {
    switch (mode) {
      case 'idle':
        return (
          <Text color="gray" dimColor>
            Ready. Awaiting command...
          </Text>
        );

      case 'architecting':
        return (
          <Box flexDirection="column" gap={1}>
            <Text color="magenta" bold>Architectural Planning</Text>
            <Text color="gray">Analyzing system invariants and structural patterns.</Text>
          </Box>
        );

      case 'debugging':
        return (
          <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1}>
            <Text color="red" bold>Debugging Mode</Text>
            <Text color="gray">Tracing execution graph and stack references.</Text>
          </Box>
        );

      case 'stress':
        return (
          <Box>
            <Text color="yellow" bold>High Load — background indexing in progress...</Text>
          </Box>
        );

      case 'coding':
      default:
        return (
          <Box flexDirection="column" gap={1}>
            <Text color="green" bold>Coding</Text>
            <Text color="gray" dimColor>Provider: {activeProvider}</Text>
          </Box>
        );
    }
  }, [mode, activeProvider]);

  return (
    <Box flexDirection="column" paddingX={1} gap={1}>
      {content}

      <Box justifyContent="space-between">
        <Text color={healthColor} dimColor>
          Health {systemHealth}%
        </Text>
        {statusLines.slice(-2).map((s, i) => (
          <Text key={i} color={s.color} dimColor>
            {s.label}: {s.value}
          </Text>
        ))}
      </Box>
    </Box>
  );
};
