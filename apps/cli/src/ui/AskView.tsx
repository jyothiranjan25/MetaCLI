/**
 * MetaCLI CLI — AskView Component
 *
 * The main Ink UI component for the `ask` command.
 * Renders streaming output from the orchestrator with:
 * - Provider indicator
 * - Live streaming text
 * - Fallback notifications
 * - Usage summary on completion
 * - Spinner during processing
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { Orchestrator, EventBus, MetaCLIEvents, StreamEvent } from '@metacli/core';
import { createContextResolver } from '../bootstrap.js';

interface AskViewProps {
  orchestrator: Orchestrator;
  eventBus: EventBus<MetaCLIEvents>;
  prompt: string;
  preferredProvider?: string;
  workingDirectory: string;
  files?: string[];
  systemPrompt?: string;
  verbose: boolean;
}

type ViewState = 'loading' | 'streaming' | 'complete' | 'error';

interface InputHandlerProps {
  onDismiss: () => void;
  isActive: boolean;
}

function InputHandler({ onDismiss, isActive }: InputHandlerProps) {
  useInput(() => {
    onDismiss();
  }, { isActive });
  return null;
}

export function AskView({
  orchestrator,
  prompt,
  preferredProvider,
  workingDirectory,
  files,
  systemPrompt,
  verbose,
}: AskViewProps): React.ReactElement {
  const { exit } = useApp();

  const [state, setState] = useState<ViewState>('loading');
  const [provider, setProvider] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [fallbackCount, setFallbackCount] = useState(0);
  const [fallbackInfo, setFallbackInfo] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [usage, setUsage] = useState<{ input?: number; output?: number }>({});
  const [durationMs, setDurationMs] = useState(0);
  const [confidence, setConfidence] = useState<number | undefined>(undefined);

  const runPrompt = useCallback(async () => {
    const startTime = Date.now();

    try {
      const generator = orchestrator.ask(prompt, {
        preferredProvider,
        workingDirectory,
        files,
        systemPrompt,
        contextResolver: createContextResolver(workingDirectory),
      });

      for await (const streamEvent of generator) {
        setProvider(streamEvent.provider);
        setFallbackCount(streamEvent.fallbackCount);
        if (streamEvent.confidence !== undefined) {
          setConfidence(streamEvent.confidence);
        }

        const event = streamEvent.event;

        switch (event.type) {
          case 'text':
            setState('streaming');
            setOutput((prev) => prev + (event as { type: 'text'; content: string }).content);
            break;

          case 'thinking':
            if (verbose) {
              setOutput(
                (prev) =>
                  prev + `\n💭 ${(event as { type: 'thinking'; content: string }).content}\n`,
              );
            }
            break;

          case 'tool_use':
            setOutput((prev) => {
              const e = event as { type: 'tool_use'; tool: string; input: unknown };
              return prev + `\n🔧 Using tool: ${e.tool}\n`;
            });
            break;

          case 'tool_result':
            // Tool results are usually verbose — only show in verbose mode
            if (verbose) {
              setOutput(
                (prev) =>
                  prev +
                  `\n📎 Tool result: ${JSON.stringify((event as { type: 'tool_result'; result: unknown }).result).slice(0, 200)}\n`,
              );
            }
            break;

          case 'rate_limit':
            setFallbackInfo(`Rate limited → switching provider...`);
            break;

          case 'error':
            setError((event as { type: 'error'; error: string }).error);
            setState('error');
            break;

          case 'done': {
            const doneEvent = event as {
              type: 'done';
              usage?: { inputTokens?: number; outputTokens?: number };
            };
            if (doneEvent.usage) {
              setUsage({
                input: doneEvent.usage.inputTokens,
                output: doneEvent.usage.outputTokens,
              });
            }
            break;
          }

          case 'routing_complete':
            // provider is already set via setProvider(streamEvent.provider) above
            break;
        }
      }

      setDurationMs(Date.now() - startTime);
      setState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }

    if (!process.stdin.isTTY) {
      const exitTimeout = process.env.METACLI_EXIT_TIMEOUT ? parseInt(process.env.METACLI_EXIT_TIMEOUT, 10) : 1000;
      setTimeout(() => exit(), exitTimeout);
    }
  }, [orchestrator, prompt, preferredProvider, workingDirectory, files, systemPrompt, verbose, exit]);



  useEffect(() => {
    runPrompt();
  }, [runPrompt]);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ◆ MetaCLI
        </Text>
        {provider && (
          <Text color="gray">
            {' '}
            → {provider}
          </Text>
        )}
        {fallbackCount > 0 && (
          <Text color="yellow"> (fallback #{fallbackCount})</Text>
        )}
      </Box>

      {/* Fallback notification */}
      {fallbackInfo && (
        <Box marginBottom={1}>
          <Text color="yellow">⚡ {fallbackInfo}</Text>
        </Box>
      )}

      {/* Loading state */}
      {state === 'loading' && (
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text>
            {provider
              ? ` Generating response via ${provider}...`
              : ' Routing prompt...'}
          </Text>
        </Box>
      )}


      {/* Streaming / Complete output */}
      {(state === 'streaming' || state === 'complete') && output && (
        <Box flexDirection="column">
          <Text>{output}</Text>
        </Box>
      )}

      {/* Streaming indicator */}
      {state === 'streaming' && (
        <Box marginTop={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="gray"> Streaming...</Text>
        </Box>
      )}

      {/* Error state */}
      {state === 'error' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red" bold>
            ❌ Error
          </Text>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {state === 'complete' && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Box marginBottom={1}>
            <Text color="green" bold>
              ✓ Complete
            </Text>
            <Text color="gray">
              {' '}
              — {provider} — {(durationMs / 1000).toFixed(1)}s
            </Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            <Text color="white">
              Summary: {prompt.length > 60 ? `${prompt.slice(0, 60)}...` : prompt}
            </Text>
            {confidence !== undefined && (
              <Text color="cyan">
                Confidence: {confidence}% (System operational confidence index)
              </Text>
            )}
          </Box>
          {(usage.input || usage.output) && (
            <Box>
              <Text color="gray">
                Tokens: {usage.input ?? '?'} in / {usage.output ?? '?'} out
              </Text>
            </Box>
          )}
          {fallbackCount > 0 && (
            <Box>
              <Text color="yellow">
                Fallbacks: {fallbackCount}
              </Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color="yellow" dimColor>
              Press any key to dismiss this view...
            </Text>
          </Box>
        </Box>
      )}
      {process.stdin.isTTY && (
        <InputHandler
          onDismiss={exit}
          isActive={state === 'complete' || state === 'error'}
        />
      )}
    </Box>
  );
}
