/**
 * MetaCLI CLI — Cognitive Streaming Renderer
 *
 * Visualises the live cognitive execution pipeline in the terminal.
 * Subscribes to an EventBus (passed as a prop) and renders the current
 * phase, active provider, context hydration progress, and partial output
 * in real time. Each state transition maps to a distinct visual state.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import type { EventBus } from '@metacli/core';
import type { MetaCLIEvents } from '@metacli/core';

export type CognitivePhase =
  | 'idle'
  | 'retrieving'
  | 'reasoning'
  | 'generating'
  | 'optimizing'
  | 'recovering';

export interface CognitiveStreamState {
  phase: CognitivePhase;
  activeProvider: string;
  contextHydration: number; // 0–100
  partialOutput: string;
  confidenceScore: number; // 0–100
}

const PHASE_COLOR: Record<CognitivePhase, string> = {
  idle: 'gray',
  retrieving: 'cyan',
  reasoning: 'blue',
  generating: 'green',
  optimizing: 'yellow',
  recovering: 'red',
};

const PHASE_LABEL: Record<CognitivePhase, string> = {
  idle: 'Idle',
  retrieving: 'Retrieving context...',
  reasoning: 'Reasoning...',
  generating: 'Generating',
  optimizing: 'Optimizing token budget...',
  recovering: 'Recovering execution...',
};

const INITIAL_STATE: CognitiveStreamState = {
  phase: 'idle',
  activeProvider: '—',
  contextHydration: 0,
  partialOutput: '',
  confidenceScore: 100,
};

export interface CognitiveStreamingRendererProps {
  eventBus: EventBus<MetaCLIEvents>;
}

export const CognitiveStreamingRenderer: React.FC<CognitiveStreamingRendererProps> = ({ eventBus }) => {
  const [state, setState] = useState<CognitiveStreamState>(INITIAL_STATE);

  const patch = useCallback((partial: Partial<CognitiveStreamState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(eventBus.on('prompt:start', ({ provider }) => {
      patch({ phase: 'generating', activeProvider: provider, partialOutput: '', contextHydration: 0 });
    }));

    unsubs.push(eventBus.on('prompt:stream', ({ event }) => {
      if (event.type === 'text') {
        setState(prev => ({
          ...prev,
          phase: 'generating',
          partialOutput: prev.partialOutput + event.content,
        }));
      } else if (event.type === 'thinking') {
        patch({ phase: 'reasoning' });
      }
    }));

    unsubs.push(eventBus.on('prompt:complete', () => {
      patch({ phase: 'idle', contextHydration: 100 });
    }));

    unsubs.push(eventBus.on('prompt:error', () => {
      patch({ phase: 'recovering' });
    }));

    unsubs.push(eventBus.on('retrieval.completed', ({ fileCount }) => {
      patch({
        phase: 'generating',
        contextHydration: Math.min(100, fileCount * 5),
      });
    }));

    unsubs.push(eventBus.on('context.optimized', () => {
      patch({ phase: 'optimizing' });
    }));

    unsubs.push(eventBus.on('prompt:fallback', ({ to }) => {
      patch({ phase: 'recovering', activeProvider: to });
    }));

    return () => unsubs.forEach(fn => fn());
  }, [eventBus, patch]);

  const phaseColor = PHASE_COLOR[state.phase];
  const confidenceColor = state.confidenceScore >= 80 ? 'green' : state.confidenceScore >= 50 ? 'yellow' : 'red';
  const hydrationBar = buildBar(state.contextHydration, 20);

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor={phaseColor}>
      <Box justifyContent="space-between">
        <Text color={phaseColor} bold>
          {PHASE_LABEL[state.phase]}
        </Text>
        <Text color="cyan" dimColor>
          {state.activeProvider}
        </Text>
      </Box>

      <Box marginTop={1} gap={2}>
        <Text color="gray">
          Context: <Text color="white">{hydrationBar}</Text> {state.contextHydration}%
        </Text>
        <Text color={confidenceColor}>
          Confidence: {state.confidenceScore}%
        </Text>
      </Box>

      {state.partialOutput.length > 0 && (
        <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text wrap="truncate-end" dimColor>
            {state.partialOutput.slice(-200)}
          </Text>
        </Box>
      )}
    </Box>
  );
};

function buildBar(percent: number, width: number): string {
  const filled = Math.round((percent / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}
