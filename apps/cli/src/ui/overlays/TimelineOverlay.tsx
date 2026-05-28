import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import path from 'node:path';
import fs from 'node:fs';

interface TimelineOverlayProps {
  workingDirectory: string;
}

interface TimelineItem {
  label: string;
  detail: string;
}

export function TimelineOverlay({ workingDirectory }: TimelineOverlayProps): React.ReactElement {
  const [items, setItems] = useState<TimelineItem[]>([]);

  useEffect(() => {
    const dbPath = path.join(workingDirectory, '.metacli', 'brain.db');
    if (!fs.existsSync(dbPath)) {
      setItems([
        { label: 'Now', detail: 'Workspace not indexed yet' },
        { label: 'Next', detail: 'Run metacli scan to build project history' },
      ]);
      return;
    }

    import('@metacli/brain').then(({ BrainStore }) => {
      const store = new BrainStore(workingDirectory);
      try {
        const memories = [
          ...store.getMemoriesByLayer('hot'),
          ...store.getMemoriesByLayer('warm'),
          ...store.getMemoriesByLayer('cold'),
        ].slice(0, 8);
        setItems(memories.length > 0
          ? memories.map((memory) => ({
              label: memory.timestamp ? new Date(memory.timestamp).toLocaleDateString() : 'Memory',
              detail: memory.summary ?? memory.content.slice(0, 80),
            }))
          : [
              { label: 'Initial', detail: 'Project brain initialized' },
              { label: 'Current', detail: 'No workflow memories recorded yet' },
            ]);
      } finally {
        store.close();
      }
    }).catch(() => {
      setItems([{ label: 'Timeline', detail: 'Project evolution unavailable' }]);
    });
  }, [workingDirectory]);

  return (
    <Box flexDirection="column">
      <Text bold color="white">Project Evolution</Text>
      <Text color="gray" dimColor>{'─'.repeat(64)}</Text>
      {items.map((item, index) => (
        <Box key={`${item.label}-${index}`} marginTop={1} gap={2}>
          <Text color="cyan" width={12}>{item.label}</Text>
          <Text color="white">{item.detail}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color="gray">Generated from persistent memory. ESC closes.</Text>
      </Box>
    </Box>
  );
}
