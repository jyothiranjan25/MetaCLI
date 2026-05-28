/**
 * MetaCLI — Brain Overlay
 * Project intelligence index status, memory stats, and codebase map.
 */

import React from 'react';
import { Box, Text } from 'ink';

interface BrainOverlayProps {
  workingDirectory: string;
  indexedFiles?: number;
  astSymbols?: number;
  memorySummaries?: number;
  lastIndexed?: string;
  brainSize?: string;
}

export function BrainOverlay({
  workingDirectory,
  indexedFiles = 0,
  astSymbols = 0,
  memorySummaries = 0,
  lastIndexed,
  brainSize = '—',
}: BrainOverlayProps): React.ReactElement {
  const coverageBar = Math.min(10, Math.round((indexedFiles / Math.max(indexedFiles, 1)) * 10));
  const coverage = '█'.repeat(coverageBar) + '░'.repeat(10 - coverageBar);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">⬡ </Text>
        <Text bold>Project Brain</Text>
        <Text color="gray">  {workingDirectory.split('/').slice(-2).join('/')}  •  ESC to close</Text>
      </Box>

      {/* Stats grid */}
      <Box gap={4} marginBottom={1}>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Indexed Files</Text>
          <Text bold color="white">{indexedFiles.toLocaleString()}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>AST Symbols</Text>
          <Text bold color="white">{astSymbols.toLocaleString()}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Memory Summaries</Text>
          <Text bold color="cyan">{memorySummaries}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Brain DB Size</Text>
          <Text bold color="white">{brainSize}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray" dimColor>Last Indexed</Text>
          <Text bold color="white">{lastIndexed ?? 'never'}</Text>
        </Box>
      </Box>

      {/* Coverage bar */}
      <Box gap={1} marginBottom={1}>
        <Text color="gray" dimColor>Coverage</Text>
        <Text color="green">{coverage}</Text>
        <Text color="gray">{indexedFiles > 0 ? '100%' : '0%'}</Text>
      </Box>

      <Text color="gray" dimColor>{'─────────────────────────────────────────'}</Text>

      {/* Memory layers */}
      <Box marginTop={1} flexDirection="column" gap={0}>
        <Text color="gray" bold dimColor>Memory Layers</Text>
        <Box gap={4} marginTop={0}>
          <Box flexDirection="column">
            <Text color="yellow">🔥 Hot</Text>
            <Text color="gray" dimColor>last 5 sessions</Text>
          </Box>
          <Box flexDirection="column">
            <Text color="cyan">❄ Warm</Text>
            <Text color="gray" dimColor>last 30 days</Text>
          </Box>
          <Box flexDirection="column">
            <Text color="gray">☁ Cold</Text>
            <Text color="gray" dimColor>archived</Text>
          </Box>
        </Box>
      </Box>

      {/* Actions */}
      <Box marginTop={1} gap={3}>
        <Text color="gray" dimColor>/reindex to rebuild</Text>
        <Text color="gray" dimColor>/compact to prune</Text>
        <Text color="gray" dimColor>/graph for deps</Text>
      </Box>
    </Box>
  );
}
