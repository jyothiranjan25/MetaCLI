/**
 * MetaCLI — Usage Overlay
 * Token usage and cost tracking per provider.
 */

import React from 'react';
import { Box, Text } from 'ink';

interface ProviderUsage {
  id: string;
  name: string;
  prompts: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  quota: 'high' | 'medium' | 'low' | 'unknown';
}

interface UsageOverlayProps {
  providers?: ProviderUsage[];
  sessionStart?: string;
}

export function UsageOverlay({ providers = [], sessionStart }: UsageOverlayProps): React.ReactElement {
  const totalCost = providers.reduce((sum, p) => sum + p.estimatedCost, 0);
  const totalPrompts = providers.reduce((sum, p) => sum + p.prompts, 0);
  const totalTokens = providers.reduce((sum, p) => sum + p.inputTokens + p.outputTokens, 0);

  const quotaColor = (q: string) =>
    q === 'high' ? 'green' : q === 'medium' ? 'yellow' : q === 'low' ? 'red' : 'gray';

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>Usage & Cost</Text>
        {sessionStart && <Text color="gray">  session since {sessionStart}  •  ESC to close</Text>}
        {!sessionStart && <Text color="gray">  this session  •  ESC to close</Text>}
      </Box>

      {providers.length === 0 ? (
        <Box paddingLeft={2}>
          <Text color="gray">No usage recorded yet. Send a prompt to track tokens.</Text>
        </Box>
      ) : (
        <>
          {providers.map((p) => (
            <Box key={p.id} flexDirection="column" marginBottom={1}>
              <Text bold color="yellow">{p.name}</Text>
              <Box gap={4} paddingLeft={2}>
                <Box flexDirection="column">
                  <Text color="gray" dimColor>Prompts</Text>
                  <Text bold>{p.prompts}</Text>
                </Box>
                <Box flexDirection="column">
                  <Text color="gray" dimColor>Input tokens</Text>
                  <Text bold>{p.inputTokens.toLocaleString()}</Text>
                </Box>
                <Box flexDirection="column">
                  <Text color="gray" dimColor>Output tokens</Text>
                  <Text bold>{p.outputTokens.toLocaleString()}</Text>
                </Box>
                <Box flexDirection="column">
                  <Text color="gray" dimColor>Est. cost</Text>
                  <Text bold color="cyan">${p.estimatedCost.toFixed(4)}</Text>
                </Box>
                <Box flexDirection="column">
                  <Text color="gray" dimColor>Quota</Text>
                  <Text bold color={quotaColor(p.quota)}>{p.quota}</Text>
                </Box>
              </Box>
            </Box>
          ))}

          <Text color="gray" dimColor>{'─────────────────────────────────────────'}</Text>

          <Box gap={4} marginTop={1} paddingLeft={2}>
            <Box flexDirection="column">
              <Text color="gray" dimColor>Total prompts</Text>
              <Text bold>{totalPrompts}</Text>
            </Box>
            <Box flexDirection="column">
              <Text color="gray" dimColor>Total tokens</Text>
              <Text bold>{totalTokens.toLocaleString()}</Text>
            </Box>
            <Box flexDirection="column">
              <Text color="gray" dimColor>Total cost</Text>
              <Text bold color="green">${totalCost.toFixed(4)}</Text>
            </Box>
          </Box>
        </>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>Costs are estimates based on standard pricing. Actual costs may vary.</Text>
      </Box>
    </Box>
  );
}
