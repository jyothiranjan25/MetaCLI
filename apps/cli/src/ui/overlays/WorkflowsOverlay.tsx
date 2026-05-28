/**
 * MetaCLI — Workflows Overlay
 * Manages active multi-agent workflow tasks, safety policy enforcement, and execution whitelists.
 */

import React from 'react';
import { Box, Text } from 'ink';

export function WorkflowsOverlay(): React.ReactElement {
  const steps = [
    { name: 'Index project workspace & build AST dependency graph', status: 'completed', agent: 'Architect' },
    { name: 'Scan code files for pattern matches & architectural rules', status: 'completed', agent: 'Linter' },
    { name: 'Propose refactored code changes inside packages/core', status: 'in-progress', agent: 'Engineer' },
    { name: 'Verify test suite compilation & run vitest test runner', status: 'pending', agent: 'QA' },
  ];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>Autonomous Workflow Manager</Text>
        <Text color="gray">  track multi-agent plans and safety bounds  •  ESC to close</Text>
      </Box>

      {/* Workflow Stats */}
      <Box gap={4} marginBottom={1}>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Active Agent</Text>
          <Text bold color="yellow">Engineer Persona</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Security Level</Text>
          <Text bold color="green">Strict Guard</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Checkpoints</Text>
          <Text bold color="white">3 created</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Step Progress</Text>
          <Text bold color="cyan">2/4 steps (50%)</Text>
        </Box>
      </Box>

      {/* Plan Steps */}
      <Box flexDirection="column" gap={0} marginBottom={1}>
        <Text bold color="cyan" dimColor>Active Checklist:</Text>
        {steps.map((s, i) => {
          let statusBullet = '   ';
          let statusColor = 'gray';
          if (s.status === 'completed') {
            statusBullet = ' [✓]';
            statusColor = 'green';
          } else if (s.status === 'in-progress') {
            statusBullet = ' [⟳]';
            statusColor = 'yellow';
          } else {
            statusBullet = ' [ ]';
            statusColor = 'gray';
          }

          return (
            <Box key={i} gap={2} paddingLeft={2}>
              <Text bold color={statusColor} width={4}>{statusBullet}</Text>
              <Text color={s.status === 'pending' ? 'gray' : 'white'} width={60}>
                {s.name}
              </Text>
              <Text color="gray" dimColor>({s.agent})</Text>
            </Box>
          );
        })}
      </Box>

      <Text color="gray" dimColor>{'  ──────────────────────────────────────────────────────────────────────────'}</Text>

      {/* Safety Whitelists */}
      <Box marginTop={1} gap={2}>
        <Text color="gray" dimColor>Git snapshotting enabled. Safety checkpoint is active.</Text>
        <Text color="gray" dimColor>Approved commands: /approve  •  Reject commands: /reject</Text>
      </Box>
    </Box>
  );
}
