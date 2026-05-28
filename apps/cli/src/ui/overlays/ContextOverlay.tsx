/**
 * MetaCLI — Context Overlay
 * Inspects active retrieval context, matching files, importance scores, and budget allocation.
 */

import React from 'react';
import { Box, Text } from 'ink';

export function ContextOverlay(): React.ReactElement {
  const contextFiles = [
    { path: 'apps/cli/src/ui/ConversationRuntime.tsx', score: 0.98, size: '20.5 KB', source: 'Active Editor' },
    { path: 'apps/cli/src/runtime/SlashCommandRuntime.ts', score: 0.92, size: '4.8 KB', source: 'Semantic Match' },
    { path: 'packages/brain/src/persistence/BrainStore.ts', score: 0.81, size: '17.7 KB', source: 'AST Walk' },
    { path: 'packages/core/src/orchestrator/Orchestrator.ts', score: 0.74, size: '12.4 KB', source: 'Semantic Match' },
  ];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>Active Context Inspector</Text>
        <Text color="gray">  what context is fed into the next prompt  •  ESC to close</Text>
      </Box>

      <Box gap={4} marginBottom={1}>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Token Budget</Text>
          <Text bold color="white">32,768</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Tokens Used</Text>
          <Text bold color="green">6,240 (19%)</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Files Attached</Text>
          <Text bold color="white">{contextFiles.length}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Pruning Mode</Text>
          <Text bold color="cyan">Semantic Compression</Text>
        </Box>
      </Box>

      <Box flexDirection="column" gap={0}>
        <Box gap={0}>
          <Text color="gray" bold dimColor>{'  File Path                                   '}</Text>
          <Text color="gray" bold dimColor>{'  Relevance  '}</Text>
          <Text color="gray" bold dimColor>{'  Size      '}</Text>
          <Text color="gray" bold dimColor>{'  Source'}</Text>
        </Box>
        <Text color="gray" dimColor>{'  ──────────────────────────────────────────────────────────────────────────'}</Text>

        {contextFiles.map((f, i) => {
          const scoreColor = f.score >= 0.9 ? 'green' : f.score >= 0.8 ? 'yellow' : 'cyan';
          const scorePercent = `${Math.round(f.score * 100)}%`;

          return (
            <Box key={i} gap={0}>
              <Text bold width={46}>{'  ' + f.path}</Text>
              <Text color={scoreColor} width={13}>{'  ' + scorePercent}</Text>
              <Text width={12}>{'  ' + f.size}</Text>
              <Text color="gray">{'  ' + f.source}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} gap={2}>
        <Text color="gray" dimColor>/files {'<pattern>'} to pin more files</Text>
        <Text color="gray" dimColor>/trace to explain context selections</Text>
      </Box>
    </Box>
  );
}
