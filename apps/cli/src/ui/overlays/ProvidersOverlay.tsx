/**
 * MetaCLI — Providers Overlay
 *
 * Lightweight interactive overlay showing provider health, auth status, and health scores.
 * Navigate with UP/DOWN arrow keys and press Enter to switch the active provider!
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface ProvidersOverlayProps {
  providers: Map<string, { installed: boolean; authenticated: boolean }>;
  healthScores?: Record<string, number>;
  cooldowns?: Record<string, string>;
  limits?: Record<string, string>;
  activeProvider: string;
  onSelectProvider?: (providerId: string) => void;
}

export function ProvidersOverlay({
  providers,
  healthScores = {},
  cooldowns = {},
  limits = {},
  activeProvider,
  onSelectProvider,
}: ProvidersOverlayProps): React.ReactElement {
  const providerList = Array.from(providers.entries());
  
  // Find current index of active provider
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const idx = providerList.findIndex(([id]) => id === activeProvider);
    return idx >= 0 ? idx : 0;
  });

  const [mountedAt] = useState(() => Date.now());

  useInput((input, key) => {
    // Ignore keypresses immediately after mounting to prevent input bleed
    // (e.g. the Enter key pressed to submit the '/providers' command)
    if (Date.now() - mountedAt < 100) {
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(providerList.length - 1, i + 1));
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.return) {
      const selected = providerList[selectedIndex];
      if (selected && onSelectProvider) {
        onSelectProvider(selected[0]);
      }
      return;
    }
  });

  return (
    <Box flexDirection="column">
      {/* Overlay header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>Providers Setup</Text>
        <Text color="gray">  {providerList.length} registered  •  ↑↓ navigate  •  Enter select  •  ESC close</Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        {/* Table header */}
        <Box gap={0}>
          <Text color="gray" bold dimColor>{'    Provider            '}</Text>
          <Text color="gray" bold dimColor>{'  Status      '}</Text>
          <Text color="gray" bold dimColor>{'  Auth        '}</Text>
          <Text color="gray" bold dimColor>{'  Available Limit         '}</Text>
          <Text color="gray" bold dimColor>{'  Health  '}</Text>
        </Box>
        <Text color="gray" dimColor>{'  ──────────────────────────────────────────────────────────────────────────'}</Text>

        {providerList.length === 0 && (
          <Box paddingLeft={2} marginTop={1}>
            <Text color="gray">No providers detected. Run </Text>
            <Text color="cyan">/reindex</Text>
            <Text color="gray"> to scan.</Text>
          </Box>
        )}

        {providerList.map(([id, info], idx) => {
          const isSelected = idx === selectedIndex;
          const isActive = id === activeProvider;
          const score = healthScores[id] ?? 100;
          const name = id.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
          const healthColor = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';
          const scoreBar = '█'.repeat(Math.round(score / 20)) + '░'.repeat(5 - Math.round(score / 20));
          const limitText = limits[id] ?? 'Unlimited';
          const isLocked = limitText.includes('Locked');

          return (
            <Box key={id} gap={0}>
              <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? '▶ ' : '  '}</Text>
              <Text bold={isSelected} color={isActive ? 'green' : isSelected ? 'cyan' : 'white'} width={22}>
                {name} {isActive ? '[ACTIVE]' : ''}
              </Text>
              <Text color={info.installed ? 'green' : 'red'} width={14}>
                {info.installed ? '  ✓ installed' : '  ✗ missing'}
              </Text>
              <Text color={info.authenticated ? 'green' : 'yellow'} width={14}>
                {info.authenticated ? '  ✓ authed' : '  ⚠ login req'}
              </Text>
              <Text color={isLocked ? 'red' : 'green'} width={26}>
                {'  '}{limitText}
              </Text>
              <Text color={healthColor} width={10}>
                {'  '}{scoreBar}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Legend */}
      <Box marginTop={1} gap={2}>
        <Text color="gray" dimColor>✓ ready</Text>
        <Text color="gray" dimColor>⚠ needs auth</Text>
        <Text color="gray" dimColor>✗ not installed</Text>
        <Text color="cyan" dimColor>Enter to toggle/activate</Text>
      </Box>
    </Box>
  );
}
