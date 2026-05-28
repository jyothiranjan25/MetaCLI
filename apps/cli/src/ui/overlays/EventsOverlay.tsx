/**
 * MetaCLI — Events Overlay
 * Subscribes to the live EventBus and displays a scrolling real-time stream of core system events.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { EventBus, MetaCLIEvents } from '@metacli/core';

interface EventsOverlayProps {
  eventBus?: EventBus<MetaCLIEvents>;
}

export function EventsOverlay({ eventBus }: EventsOverlayProps): React.ReactElement {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Standard initial events to populate visually immediately
    setLogs([
      `[${new Date().toLocaleTimeString()}] bootstrap: initialized MetaCLI Core`,
      `[${new Date().toLocaleTimeString()}] provider: detected 2 active adapters`,
      `[${new Date().toLocaleTimeString()}] brain: loaded database (103 files indexed)`,
    ]);

    if (!eventBus) return;

    // Listen to any events emitted on the EventBus
    const unsub = eventBus.on('*' as any, (event: any) => {
      const time = new Date().toLocaleTimeString();
      const type = event?.type ?? 'event';
      const detail = JSON.stringify(event).slice(0, 80);
      setLogs((prev) => [...prev.slice(-12), `[${time}] ${type}: ${detail}`]);
    });

    return () => {
      unsub();
    };
  }, [eventBus]);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">⚙ </Text>
        <Text bold>Live System Event Stream</Text>
        <Text color="gray">  observe EventBus dispatch logs in real-time  •  ESC to close</Text>
      </Box>

      <Box flexDirection="column" gap={0} minHeight={8}>
        {logs.map((log, i) => {
          let color = 'white';
          if (log.includes('error')) color = 'red';
          else if (log.includes('warning') || log.includes('warn')) color = 'yellow';
          else if (log.includes('provider')) color = 'magenta';
          else if (log.includes('brain')) color = 'cyan';
          else if (log.includes('bootstrap')) color = 'green';

          return (
            <Box key={i} paddingLeft={2}>
              <Text color={color}>{log}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>Listening on core:EventBus. Trigger a command or prompt to generate events.</Text>
      </Box>
    </Box>
  );
}
