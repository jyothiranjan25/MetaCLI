import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import path from 'node:path';
import fs from 'node:fs';

interface MapOverlayProps {
  workingDirectory: string;
}

interface DomainGroup {
  name: string;
  files: string[];
}

export function MapOverlay({ workingDirectory }: MapOverlayProps): React.ReactElement {
  const [domains, setDomains] = useState<DomainGroup[]>([]);

  useEffect(() => {
    const dbPath = path.join(workingDirectory, '.metacli', 'brain.db');
    if (!fs.existsSync(dbPath)) {
      setDomains([
        { name: 'Core', files: ['orchestrator', 'runtime', 'events'] },
        { name: 'Brain', files: ['indexing', 'memory', 'retrieval'] },
        { name: 'CLI', files: ['commands', 'ui', 'overlays'] },
      ]);
      return;
    }

    import('@metacli/brain').then(({ BrainStore, SemanticProjectMapGenerator }) => {
      const store = new BrainStore(workingDirectory);
      try {
        const map = new SemanticProjectMapGenerator().generate(store);
        setDomains([
          ...map.children.map((child) => ({ name: child.domainName.replace(' Domain', ''), files: child.services.slice(0, 5) })),
          ...(map.services.length > 0 ? [{ name: 'System', files: map.services.slice(0, 5) }] : []),
        ]);
      } finally {
        store.close();
      }
    }).catch(() => {
      setDomains([{ name: 'Workspace', files: ['semantic map unavailable'] }]);
    });
  }, [workingDirectory]);

  return (
    <Box flexDirection="column">
      <Text bold color="white">Repository Topology</Text>
      <Text color="gray" dimColor>{'─'.repeat(64)}</Text>
      {domains.map((domain) => (
        <Box key={domain.name} flexDirection="column" marginTop={1}>
          <Text color="cyan">{domain.name}</Text>
          {domain.files.length === 0 ? (
            <Text color="gray">└─ no indexed services</Text>
          ) : domain.files.map((file, index) => (
            <Text key={file} color="gray">{index === domain.files.length - 1 ? '└─' : '├─'} {file}</Text>
          ))}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color="gray">Generated from semantic project map. ESC closes.</Text>
      </Box>
    </Box>
  );
}
