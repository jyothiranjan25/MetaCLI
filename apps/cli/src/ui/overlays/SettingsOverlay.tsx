/**
 * MetaCLI — Settings Overlay
 * Displays active configuration choices, security policies, and environment bounds.
 */

import React from 'react';
import { Box, Text } from 'ink';

export function SettingsOverlay(): React.ReactElement {
  const settingsGroups = [
    {
      title: 'AI Orchestration Settings',
      items: [
        { key: 'Preferred Provider', value: 'Auto-Routing (Claude/Gemini)', type: 'string' },
        { key: 'Stream JSON Chunking', value: 'Enabled', type: 'boolean' },
        { key: 'Fallback Retries', value: '3 times', type: 'number' },
      ],
    },
    {
      title: 'Project Brain Settings',
      items: [
        { key: 'Auto-scan on launch', value: 'Enabled', type: 'boolean' },
        { key: 'Symbol Exclusions', value: 'node_modules, dist, .git', type: 'string' },
        { key: 'PageRank Importance', value: 'Enabled', type: 'boolean' },
      ],
    },
    {
      title: 'Security Boundary Policies',
      items: [
        { key: 'Path boundary checks', value: 'Strict Isolation', type: 'string' },
        { key: 'Environment Sanitizer', value: 'Active', type: 'boolean' },
        { key: 'Git Safety Checkpoints', value: 'Pre-Execution Auto', type: 'string' },
      ],
    },
  ];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>System Settings</Text>
        <Text color="gray">  examine config schemas  •  ESC to close</Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        {settingsGroups.map((group, idx) => (
          <Box key={idx} flexDirection="column">
            <Text bold color="yellow">◇ {group.title}</Text>
            {group.items.map((item, i) => (
              <Box key={i} paddingLeft={2} gap={2}>
                <Text color="gray" width={25}>{item.key}</Text>
                <Text bold color={typeof item.value === 'string' && item.value.includes('Enabled') || item.value === 'Active' ? 'green' : 'white'}>
                  {item.value}
                </Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>

      <Box marginTop={1} gap={2}>
        <Text color="gray" dimColor>Config loaded from: /Users/jo/Documents/Development/REACT/MetaCLI/.metaclirc</Text>
        <Text color="gray" dimColor>Run /reload to re-apply modifications</Text>
      </Box>
    </Box>
  );
}
