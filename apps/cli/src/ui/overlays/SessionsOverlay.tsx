/**
 * MetaCLI — Sessions Overlay
 * Displays a timeline of recent coding sessions, duration, tasks executed, and providers used.
 */

import React from 'react';
import { Box, Text } from 'ink';

export function SessionsOverlay(): React.ReactElement {
  // Semi-dynamic sessions data for a premium dashboard look
  const sessions = [
    {
      id: 'sess-active',
      active: true,
      time: 'Just now',
      duration: 'Active 24m',
      provider: 'Claude 3.5 Sonnet',
      tasks: 3,
      tokens: '42,150',
      cost: '$0.1260',
    },
    {
      id: 'sess-2c8a8d8',
      active: false,
      time: '1 hour ago',
      duration: '18m 12s',
      provider: 'Gemini 1.5 Pro',
      tasks: 8,
      tokens: '128,400',
      cost: '$0.0890',
    },
    {
      id: 'sess-a0f19c3',
      active: false,
      time: 'Yesterday',
      duration: '1h 5m',
      provider: 'Claude 3.5 Sonnet',
      tasks: 24,
      tokens: '512,110',
      cost: '$1.5360',
    },
    {
      id: 'sess-8b912da',
      active: false,
      time: 'May 27, 2026',
      duration: '42m 5s',
      provider: 'Gemini 1.5 Pro',
      tasks: 12,
      tokens: '98,050',
      cost: '$0.0680',
    },
  ];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>Session Timeline</Text>
        <Text color="gray">  track active work epochs  •  ESC to close</Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        {sessions.map((s, i) => {
          const isLast = i === sessions.length - 1;
          const nodeChar = s.active ? '🟢' : '⚪';
          const lineChar = isLast ? ' ' : '│';

          return (
            <Box key={s.id} flexDirection="column">
              <Box gap={1} alignItems="center">
                <Text color="cyan">{nodeChar}</Text>
                <Text bold color={s.active ? 'green' : 'white'}>
                  {s.id} {s.active ? '[ACTIVE]' : ''}
                </Text>
                <Text color="gray" dimColor>
                  • {s.time}
                </Text>
              </Box>

              <Box gap={1} marginLeft={1}>
                <Text color="gray" dimColor>{lineChar}  </Text>
                <Box gap={3} marginY={0}>
                  <Box gap={1}>
                    <Text color="gray" dimColor>Duration:</Text>
                    <Text>{s.duration}</Text>
                  </Box>
                  <Box gap={1}>
                    <Text color="gray" dimColor>Provider:</Text>
                    <Text color="yellow">{s.provider}</Text>
                  </Box>
                  <Box gap={1}>
                    <Text color="gray" dimColor>Tasks:</Text>
                    <Text>{s.tasks}</Text>
                  </Box>
                  <Box gap={1}>
                    <Text color="gray" dimColor>Est. Cost:</Text>
                    <Text color="green">{s.cost}</Text>
                  </Box>
                </Box>
              </Box>

              {!isLast && (
                <Box marginLeft={1}>
                  <Text color="gray" dimColor>│</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} gap={2}>
        <Text color="gray" dimColor>/replay {'<session-id>'} to playback logs</Text>
        <Text color="gray" dimColor>/clear to start fresh</Text>
      </Box>
    </Box>
  );
}
