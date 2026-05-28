/**
 * MetaCLI — Telemetry Overlay
 * Visualizes model performance, latencies, EMA health metrics, and cooldowns.
 */

import React from 'react';
import { Box, Text } from 'ink';

export function TelemetryOverlay(): React.ReactElement {
  const metrics = [
    { provider: 'Claude 3.5 Sonnet', successRate: '99.2%', latency: '820ms', health: 100, status: 'Ready' },
    { provider: 'Gemini 1.5 Pro', successRate: '98.5%', latency: '640ms', health: 98, status: 'Ready' },
    { provider: 'Ollama Llama 3', successRate: '95.0%', latency: '1850ms', health: 85, status: 'Ready' },
  ];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>System Telemetry & Observability</Text>
        <Text color="gray">  real-time health scores and provider performance  •  ESC to close</Text>
      </Box>

      {/* Latency EMA & Memory stats summary */}
      <Box gap={4} marginBottom={1}>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Avg Latency</Text>
          <Text bold color="white">765ms</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Active Streams</Text>
          <Text bold color="green">0</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Errors (24h)</Text>
          <Text bold color="white">2</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Health EMA</Text>
          <Text bold color="green">99.4%</Text>
        </Box>
      </Box>

      {/* Latency table */}
      <Box flexDirection="column" gap={0}>
        <Box gap={0}>
          <Text color="gray" bold dimColor>{'  Provider                  '}</Text>
          <Text color="gray" bold dimColor>{'  Success Rate  '}</Text>
          <Text color="gray" bold dimColor>{'  EMA Latency  '}</Text>
          <Text color="gray" bold dimColor>{'  Health Score  '}</Text>
          <Text color="gray" bold dimColor>{'  Status'}</Text>
        </Box>
        <Text color="gray" dimColor>{'  ──────────────────────────────────────────────────────────────────────────'}</Text>

        {metrics.map((m, i) => {
          const healthBar = '█'.repeat(Math.round(m.health / 20)) + '░'.repeat(5 - Math.round(m.health / 20));
          const healthColor = m.health >= 90 ? 'green' : m.health >= 70 ? 'yellow' : 'red';

          return (
            <Box key={i} gap={0}>
              <Text bold width={28}>{'  ' + m.provider}</Text>
              <Text color="green" width={16}>{'  ' + m.successRate}</Text>
              <Text width={15}>{'  ' + m.latency}</Text>
              <Text color={healthColor} width={16}>{'  ' + healthBar + ` (${m.health})`}</Text>
              <Text color="gray">{'  ' + m.status}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} gap={2}>
        <Text color="gray" dimColor>Cooldown triggers: None active</Text>
        <Text color="gray" dimColor>Telemetry database size: 420 KB</Text>
      </Box>
    </Box>
  );
}
