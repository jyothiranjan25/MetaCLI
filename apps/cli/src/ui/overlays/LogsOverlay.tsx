/**
 * MetaCLI — Logs Overlay
 * Displays internal system diagnostics, execution stack traces, and engine status logs.
 */

import React from 'react';
import { Box, Text } from 'ink';

export function LogsOverlay(): React.ReactElement {
  const logLines = [
    `[INFO  2026-05-29 00:49:12] SetupManager: composite package configurations resolved successfully`,
    `[DEBUG 2026-05-29 00:49:13] Cosmiconfig: merging local .metaclirc configurations`,
    `[INFO  2026-05-29 00:49:13] BrainStore: sqlite connected to database boundary`,
    `[DEBUG 2026-05-29 00:49:15] ClaudeAdapter: executing execa child process query`,
    `[INFO  2026-05-29 00:49:16] PathGuard: validation passed for path boundary /Users/jo/Documents`,
    `[DEBUG 2026-05-29 00:49:20] Indexer: AST walk parsed 38 node symbol declarations`,
    `[INFO  2026-05-29 00:49:25] IntentClassifier: query mapped to navigation intent with 94.2% confidence`,
  ];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="red">⚙ </Text>
        <Text bold>System Diagnostics & Logs</Text>
        <Text color="gray">  stderr trace output  •  ESC to close</Text>
      </Box>

      <Box flexDirection="column" gap={0} minHeight={8}>
        {logLines.map((line, i) => {
          let typeColor = 'gray';
          if (line.includes('INFO')) typeColor = 'green';
          else if (line.includes('DEBUG')) typeColor = 'cyan';
          else if (line.includes('WARN')) typeColor = 'yellow';
          else if (line.includes('ERROR')) typeColor = 'red';

          return (
            <Box key={i} paddingLeft={2}>
              <Text color={typeColor} bold>{line.slice(1, 6)}</Text>
              <Text color="gray" dimColor>{line.slice(6, 27)}</Text>
              <Text>{line.slice(27)}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>Log file located at ~/.metacli/logs/stderr.log (Size: 124 KB)</Text>
      </Box>
    </Box>
  );
}
