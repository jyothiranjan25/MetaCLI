/**
 * MetaCLI — Replay Overlay
 * Deterministically records and plays back conversation threads and tool invocations.
 */

import React from 'react';
import { Box, Text } from 'ink';

export function ReplayOverlay(): React.ReactElement {
  const snapshots = [
    { id: 'snap-20260528-1', name: 'Build JWT Middleware', date: '10m ago', events: 14, status: 'Completed' },
    { id: 'snap-20260528-2', name: 'Refactor Workspace Paths', date: '1h ago', events: 32, status: 'Rolled Back' },
    { id: 'snap-20260527-1', name: 'Integrate SQLite Persistent Brain', date: 'Yesterday', events: 88, status: 'Completed' },
  ];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>Deterministic Session Replay</Text>
        <Text color="gray">  playback prompts, tool outputs, and filesystem outcomes  •  ESC to close</Text>
      </Box>

      {/* Snapshots list */}
      <Box flexDirection="column" gap={0}>
        <Box gap={0}>
          <Text color="gray" bold dimColor>{'  Snapshot ID                '}</Text>
          <Text color="gray" bold dimColor>{'  Workflow Title                  '}</Text>
          <Text color="gray" bold dimColor>{'  Events  '}</Text>
          <Text color="gray" bold dimColor>{'  Created    '}</Text>
          <Text color="gray" bold dimColor>{'  Status'}</Text>
        </Box>
        <Text color="gray" dimColor>{'  ────────────────────────────────────────────────────────────────────────────────────'}</Text>

        {snapshots.map((s, i) => {
          const statusColor = s.status === 'Completed' ? 'green' : 'red';

          return (
            <Box key={i} gap={0}>
              <Text bold color="cyan" width={28}>{'  ' + s.id}</Text>
              <Text width={32}>{s.name}</Text>
              <Text width={10}>{'  ' + s.events}</Text>
              <Text width={13}>{'  ' + s.date}</Text>
              <Text color={statusColor}>{'  ' + s.status}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} gap={2}>
        <Text color="gray" dimColor>/replay --load {'<snapshot-id>'} to restore state</Text>
        <Text color="gray" dimColor>Deterministic tracking: Active (recorded 4.2 MB metadata)</Text>
      </Box>
    </Box>
  );
}
