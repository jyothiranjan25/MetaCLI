/**
 * MetaCLI — Providers Overlay
 *
 * Lightweight overlay showing provider health, auth status, and health scores.
 * Inspired by k9s and LazyGit panel aesthetics.
 */

import React from 'react';
import { Box, Text } from 'ink';

interface ProvidersOverlayProps {
  providers: Map<string, { installed: boolean; authenticated: boolean }>;
  healthScores?: Record<string, number>;
  cooldowns?: Record<string, string>;
}

export function ProvidersOverlay({
  providers,
  healthScores = {},
  cooldowns = {},
}: ProvidersOverlayProps): React.ReactElement {
  const providerList = Array.from(providers.entries());

  return (
    <Box flexDirection="column">
      {/* Overlay header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>Providers</Text>
        <Text color="gray">  {providerList.length} registered  •  ESC to close</Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        {/* Table header */}
        <Box gap={0}>
          <Text color="gray" bold dimColor>{'  Provider          '}</Text>
          <Text color="gray" bold dimColor>{'  Status      '}</Text>
          <Text color="gray" bold dimColor>{'  Auth        '}</Text>
          <Text color="gray" bold dimColor>{'  Health  '}</Text>
          <Text color="gray" bold dimColor>{'  Cooldown'}</Text>
        </Box>
        <Text color="gray" dimColor>{'  ─────────────────────────────────────────────────────────'}</Text>

        {providerList.length === 0 && (
          <Box paddingLeft={2} marginTop={1}>
            <Text color="gray">No providers detected. Run </Text>
            <Text color="cyan">/reindex</Text>
            <Text color="gray"> to scan.</Text>
          </Box>
        )}

        {providerList.map(([id, info]) => {
          const score = healthScores[id] ?? 100;
          const cooldown = cooldowns[id];
          const name = id.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
          const healthColor = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';
          const scoreBar = '█'.repeat(Math.round(score / 20)) + '░'.repeat(5 - Math.round(score / 20));

          return (
            <Box key={id} gap={0}>
              <Text bold width={20}>{'  ' + name}</Text>
              <Text color={info.installed ? 'green' : 'red'} width={14}>
                {info.installed ? '  ✓ installed' : '  ✗ missing'}
              </Text>
              <Text color={info.authenticated ? 'green' : 'yellow'} width={14}>
                {info.authenticated ? '  ✓ authed' : '  ⚠ login req'}
              </Text>
              <Text color={healthColor} width={10}>
                {'  '}{scoreBar}
              </Text>
              <Text color={cooldown ? 'red' : 'gray'}>
                {'  '}{cooldown ?? '—'}
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
        <Text color="gray" dimColor>/provider {'<id>'} to switch</Text>
      </Box>
    </Box>
  );
}
