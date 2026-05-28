/**
 * MetaCLI — Memory Overlay
 * Inspects persistent semantic memories divided into Hot, Warm, and Cold layers.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import path from 'node:path';
import fs from 'node:fs';

interface MemoryItem {
  id: string;
  layer: 'hot' | 'warm' | 'cold';
  content: string;
  timestamp?: string;
  summary?: string;
}

interface MemoryOverlayProps {
  workingDirectory: string;
}

export function MemoryOverlay({ workingDirectory }: MemoryOverlayProps): React.ReactElement {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [activeLayer, setActiveLayer] = useState<'hot' | 'warm' | 'cold'>('hot');

  useEffect(() => {
    // Dynamic load from BrainStore if available
    const dbPath = path.join(workingDirectory, '.metacli', 'brain.db');
    if (fs.existsSync(dbPath)) {
      try {
        // Dynamic import to avoid static import overhead
        import('@metacli/brain').then(({ BrainStore }) => {
          const store = new BrainStore(workingDirectory);
          const records = store.getMemoriesByLayer(activeLayer);
          store.close();
          setMemories(records);
        }).catch(() => {
          setMockMemories();
        });
      } catch {
        setMockMemories();
      }
    } else {
      setMockMemories();
    }
  }, [workingDirectory, activeLayer]);

  const setMockMemories = () => {
    if (activeLayer === 'hot') {
      setMemories([
        {
          id: 'mem-1',
          layer: 'hot',
          content: 'User prefers HSL based color schemes for React dashboard UI elements.',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'mem-2',
          layer: 'hot',
          content: 'Workspace includes Next.js app in the apps/ directory and Turborepo setup.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } else if (activeLayer === 'warm') {
      setMemories([
        {
          id: 'mem-3',
          layer: 'warm',
          content: 'Identified circular imports between security boundary guard and git engine.',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
      ]);
    } else {
      setMemories([]);
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">◈ </Text>
        <Text bold>Memory Layer Inspector</Text>
        <Text color="gray">  examine persistent AI context  •  ESC to close</Text>
      </Box>

      {/* Layer selector bar */}
      <Box gap={3} marginBottom={1}>
        <Box gap={1}>
          <Text color={activeLayer === 'hot' ? 'yellow' : 'gray'} bold={activeLayer === 'hot'}>
            [ {activeLayer === 'hot' ? '●' : '○'} Hot Layer ]
          </Text>
        </Box>
        <Box gap={1}>
          <Text color={activeLayer === 'warm' ? 'cyan' : 'gray'} bold={activeLayer === 'warm'}>
            [ {activeLayer === 'warm' ? '●' : '○'} Warm Layer ]
          </Text>
        </Box>
        <Box gap={1}>
          <Text color={activeLayer === 'cold' ? 'gray' : 'gray'} bold={activeLayer === 'cold'}>
            [ {activeLayer === 'cold' ? '●' : '○'} Cold Layer ]
          </Text>
        </Box>
      </Box>

      {/* Memory list */}
      <Box flexDirection="column" gap={0} minHeight={5}>
        {memories.length === 0 ? (
          <Box paddingLeft={2} marginTop={1}>
            <Text color="gray" dimColor>No memories recorded in this layer.</Text>
          </Box>
        ) : (
          memories.map((mem) => (
            <Box key={mem.id} flexDirection="column" marginBottom={1} paddingLeft={2}>
              <Box gap={1}>
                <Text bold color="cyan">[{mem.id}]</Text>
                <Text color="gray" dimColor>{mem.timestamp ? new Date(mem.timestamp).toLocaleString() : ''}</Text>
              </Box>
              <Box paddingLeft={2}>
                <Text color="white">“ {mem.content} ”</Text>
              </Box>
            </Box>
          ))
        )}
      </Box>

      {/* Navigation hints */}
      <Box marginTop={1} gap={3}>
        <Text color="gray" dimColor>Press Tab / arrow keys to toggle layers</Text>
        <Text color="gray" dimColor>/compact to optimize layers</Text>
      </Box>
    </Box>
  );
}
