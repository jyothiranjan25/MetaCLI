/**
 * MetaCLI — Help Overlay
 * Displays all slash commands organized by category.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { SLASH_COMMANDS, CATEGORY_META, type CommandCategory } from '../../runtime/SlashCommandRegistry.js';

export function HelpOverlay(): React.ReactElement {
  const byCategory = SLASH_COMMANDS.reduce<Record<string, typeof SLASH_COMMANDS>>((acc, cmd) => {
    const cat = cmd.category;
    if (!acc[cat]) acc[cat] = [];
    // Only show primary names (no duplicates from aliases)
    if (!acc[cat]!.find((c) => c.name === cmd.name)) {
      acc[cat]!.push(cmd);
    }
    return acc;
  }, {});

  const categories: CommandCategory[] = ['navigation', 'runtime', 'provider', 'workflow', 'context', 'debug', 'system'];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">◇ </Text>
        <Text bold>Slash Commands</Text>
        <Text color="gray">  type / to activate  •  Ctrl+K for palette  •  ESC to close</Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        {categories.map((cat) => {
          const cmds = byCategory[cat];
          if (!cmds || cmds.length === 0) return null;
          const meta = CATEGORY_META[cat];

          return (
            <Box key={cat} flexDirection="column">
              <Box gap={1}>
                <Text color={meta.color as any}>{meta.icon}</Text>
                <Text bold color={meta.color as any}>{meta.label}</Text>
              </Box>
              {cmds.map((cmd) => (
                <Box key={cmd.name} paddingLeft={2} gap={2}>
                  <Text color="cyan" width={20}>
                    {'/' + cmd.name}{cmd.argHint ? ' ' + cmd.argHint : ''}
                  </Text>
                  <Text color="gray">{cmd.description}</Text>
                  {cmd.shortcut && (
                    <Text color="gray" dimColor>  {cmd.shortcut}</Text>
                  )}
                </Box>
              ))}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Keyboard: </Text>
        <Text color="gray" dimColor>↑↓ history  •  Tab autocomplete  •  Ctrl+K palette  •  ESC close overlay
        </Text>
      </Box>
    </Box>
  );
}
