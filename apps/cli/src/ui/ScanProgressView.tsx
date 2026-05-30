import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import type { WorkspaceScanner, BrainStore } from '@metacli/brain';
import type { EventBus, MetaCLIEvents } from '@metacli/core';

interface ScanProgressViewProps {
  scanner: WorkspaceScanner;
  store: BrainStore;
  eventBus: EventBus<MetaCLIEvents>;
  force: boolean;
}

type ScanState = 'idle' | 'scanning' | 'complete' | 'error';

export function ScanProgressView({
  scanner,
  store,
  eventBus,
  force,
}: ScanProgressViewProps): React.ReactElement {
  const { exit } = useApp();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [phase, setPhase] = useState<string>('Initializing');
  const [progress, setProgress] = useState<number>(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [durationMs, setDurationMs] = useState<number>(0);
  const [fileCount, setFileCount] = useState<number>(0);
  const [error, setError] = useState<string>('');

  const runScan = useCallback(async () => {
    setScanState('scanning');
    try {
      const result = await scanner.scan({
        forceRescan: force,
      });
      setFileCount(result.filesScanned);
      setDurationMs(result.durationMs);
      setScanState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setScanState('error');
    }

    // Give a brief moment to render before exiting the terminal process
    setTimeout(() => {
      exit();
    }, 150);
  }, [scanner, force, exit]);

  // Subscribe to real-time scanning events
  useEffect(() => {
    const unsubStart = eventBus.on('brain:scan_start', () => {
      setPhase('Crawl Directories');
      setProgress(0.05);
    });

    const unsubProgress = eventBus.on('brain:scan_progress', (data) => {
      if (data.phase === 'hashing_indexing') {
        setPhase('AST Parse & Hash Code');
      } else if (data.phase === 'optimizing_graph') {
        setPhase('Module Optimization (PageRank)');
      }
      setProgress(data.progress);
      if (data.detail) {
        setCurrentFile(data.detail);
      }
    });

    return () => {
      unsubStart();
      unsubProgress();
    };
  }, [eventBus]);

  // Boot the scanner once component mounts
  useEffect(() => {
    runScan();
  }, [runScan]);

  const renderProgressBar = (value: number) => {
    const width = 30;
    const filledCount = Math.round(value * width);
    const emptyCount = width - filledCount;
    return (
      <Text>
        <Text color="cyan">{'█'.repeat(filledCount)}</Text>
        <Text color="gray">{'░'.repeat(emptyCount)}</Text>
      </Text>
    );
  };

  return (
    <Box flexDirection="column" paddingX={1} marginY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">◆ MetaCLI Brain Indexer</Text>
      </Box>

      {scanState === 'scanning' && (
        <Box flexDirection="column">
          <Box gap={1}>
            <Text color="cyan"><Spinner type="dots" /></Text>
            <Text bold color="yellow">[{phase}]</Text>
            <Text color="gray">{Math.round(progress * 100)}%</Text>
          </Box>
          <Box marginTop={1}>
            {renderProgressBar(progress)}
          </Box>
          {currentFile && (
            <Box marginTop={1}>
              <Text color="gray" dimColor>
                {/* Show last 3 segments so it fits in any terminal width */}
                {currentFile.split('/').slice(-3).join('/')}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {scanState === 'complete' && (
        <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1}>
          <Text bold color="green">✓ Codebase scan complete!</Text>
          <Text marginTop={1}>Indexed files: <Text bold color="cyan">{fileCount}</Text></Text>
          <Text>Duration:      <Text bold color="cyan">{(durationMs / 1000).toFixed(2)}s</Text></Text>
          <Text color="gray" marginTop={1}>SQLite local Persistent Brain (.metacli/brain.db) is updated.</Text>
        </Box>
      )}

      {scanState === 'error' && (
        <Box flexDirection="column" borderStyle="single" borderColor="red" paddingX={1}>
          <Text bold color="red">❌ Indexer Error</Text>
          <Text color="red" marginTop={1}>{error}</Text>
        </Box>
      )}
    </Box>
  );
}
