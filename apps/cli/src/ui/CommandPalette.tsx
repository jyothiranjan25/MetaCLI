/**
 * MetaCLI — Command Palette
 *
 * Ctrl+K overlay with fuzzy search, arrow navigation, category grouping,
 * and instant command switching. Inspired by Warp, Raycast, and VSCode.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { SlashCommandRuntime } from '../runtime/SlashCommandRuntime.js';
import { CATEGORY_META, type CommandCategory } from '../runtime/SlashCommandRegistry.js';

interface CommandPaletteProps {
  runtime: SlashCommandRuntime;
  onExecute: (command: string) => void;
  onClose: () => void;
}

export function CommandPalette({ runtime, onExecute, onClose }: CommandPaletteProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = runtime.searchCommands(query, 10);

  const handleSelect = useCallback(
    (index: number) => {
      const result = results[index];
      if (result) {
        const cmd = result.command;
        const text = '/' + cmd.name + (cmd.argHint ? ' ' : '');
        onExecute(text);
        onClose();
      }
    },
    [results, onExecute, onClose],
  );

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.return) {
      handleSelect(selectedIndex);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
      return;
    }

    if (key.backspace || key.delete) {
      setQuery((q) => q.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (input && input.length === 1 && !key.ctrl && !key.meta) {
      setQuery((q) => q + input);
      setSelectedIndex(0);
    }
  });

  // Group results by category for display
  const recent = runtime.getRecentCommands(3);

  return (
    <Box flexDirection="column" paddingX={2} paddingY={0} marginTop={1} marginBottom={1}>
      <Box gap={1} marginBottom={0}>
        <Text color="cyan">Search</Text>
        <Text bold color="white">Commands Workflows Memories Files Architecture</Text>
        <Text color="gray" dimColor>  ESC close  ↑↓ navigate  Enter execute</Text>
      </Box>

      <Text color="gray" dimColor>{'─'.repeat(78)}</Text>

      <Box paddingX={0} marginTop={0} marginBottom={0}>
        <Text color="cyan">› </Text>
        <Text>{query}</Text>
        <Text color="green">▌</Text>
        {!query && <Text color="gray" dimColor> search anything...</Text>}
      </Box>

      {/* Recent commands (when no query) */}
      {!query && recent.length > 0 && (
        <Box flexDirection="column" marginTop={0}>
          <Text color="gray" dimColor>  Recent</Text>
          {recent.map((cmd, i) => (
            <Box key={i} paddingLeft={2}>
              <Text color="gray">↺ </Text>
              <Text color={selectedIndex === i ? 'cyan' : 'white'}>{cmd}</Text>
            </Box>
          ))}
          <Text color="gray" dimColor>{'  ─────────────────────────────────────────'}</Text>
        </Box>
      )}

      {/* Search results */}
      <Box flexDirection="column" marginTop={0}>
        {results.length === 0 && (
          <Box paddingLeft={2} marginTop={0}>
            <Text color="gray">No commands match </Text>
            <Text color="yellow">/{query}</Text>
          </Box>
        )}

        {results.map(({ command: cmd }, i) => {
          const isSelected = i === selectedIndex;
          const meta = CATEGORY_META[cmd.category as CommandCategory];

          return (
            <Box
              key={cmd.name}
              paddingLeft={1}
              paddingRight={1}
            >
              {/* Selection indicator */}
              <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? '▶ ' : '  '}</Text>

              {/* Category icon */}
              <Text color={meta.color as any} dimColor={!isSelected}>{meta.icon} </Text>

              {/* Command name */}
              <Text
                bold={isSelected}
                color={isSelected ? 'cyan' : 'white'}
                width={22}
              >
                /{cmd.name}
                {cmd.argHint && <Text color="gray" dimColor> {cmd.argHint}</Text>}
              </Text>

              {/* Description */}
              <Text color={isSelected ? 'white' : 'gray'} dimColor={!isSelected}>
                {cmd.description}
              </Text>

              {/* Shortcut */}
              {cmd.shortcut && (
                <Text color="gray" dimColor>  {cmd.shortcut}</Text>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box marginTop={0} gap={2} paddingLeft={1}>
        <Text color="gray" dimColor>Enter</Text>
        <Text color="gray" dimColor>↑↓ navigate</Text>
        <Text color="gray" dimColor>ESC close</Text>
        {results[selectedIndex] && (
          <>
            <Text color="gray" dimColor>•</Text>
            <Text color="cyan" dimColor>/{results[selectedIndex]?.command.name}</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
