/**
 * MetaCLI CLI — SecuritySupervisorView Component
 *
 * Polished React Ink dashboard acting as a visual guardian during autonomous
 * command and workflow executions.
 * Displays:
 * - Current safety modes & active workspace containment rules.
 * - Auto-approval Whitelist logs.
 * - Active Git Checkpoint details.
 * - Red warning banners for medium/high-risk actions.
 * - Interactive Block [N], Approve [Y], or Rollback [R] inputs.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';

export interface SecuritySupervisorViewProps {
  command: string;
  riskLevel: string;
  riskReason: string;
  securityMode: string;
  workspaceRoot: string;
  snapshotKey?: string;
  onDecision: (approved: boolean, rollback?: boolean) => void;
}

export function SecuritySupervisorView({
  command,
  riskLevel,
  riskReason,
  securityMode,
  workspaceRoot,
  snapshotKey,
  onDecision,
}: SecuritySupervisorViewProps): React.ReactElement {
  const { exit } = useApp();
  const [decision, setDecision] = useState<'pending' | 'approved' | 'blocked' | 'rolled_back'>('pending');

  // Listen to keyboard keypress events
  useInput((input, key) => {
    if (decision !== 'pending') return;

    const keyChar = input.toLowerCase();

    if (keyChar === 'y') {
      setDecision('approved');
      onDecision(true, false);
    } else if (keyChar === 'n') {
      setDecision('blocked');
      onDecision(false, false);
    } else if (keyChar === 'r') {
      setDecision('rolled_back');
      onDecision(false, true);
    }
  });

  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1} borderStyle="round" borderColor="yellow">
      {/* Title Header */}
      <Box marginBottom={1}>
        <Text bold color="yellow">
          🛡◆ MetaCLI Security Supervisor
        </Text>
        <Text color="gray"> | Workspace: {workspaceRoot}</Text>
      </Box>

      {/* active context */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold>• Safety Mode: </Text>
          <Text color="cyan">{securityMode.toUpperCase()}</Text>
        </Box>
        {snapshotKey && (
          <Box>
            <Text bold color="green">✓ Git Checkpoint Active: </Text>
            <Text color="gray">{snapshotKey}</Text>
          </Box>
        )}
      </Box>

      {/* Hazard Warning Banners */}
      <Box flexDirection="column" borderStyle="single" borderColor="red" paddingX={1} marginBottom={1}>
        <Text bold color="red">
          ⚠️ Potentially Destructive Operation Detected!
        </Text>
        <Box marginTop={1}>
          <Text bold>Command: </Text>
          <Text color="white" bold bg="red"> {command} </Text>
        </Box>
        <Box marginTop={0.5}>
          <Text bold>Risk Tier: </Text>
          <Text color="red" bold>{riskLevel.toUpperCase()}</Text>
        </Box>
        <Box>
          <Text bold>Reason:    </Text>
          <Text color="gray">{riskReason}</Text>
        </Box>
      </Box>

      {/* decision prompt */}
      {decision === 'pending' ? (
        <Box flexDirection="column">
          <Text bold color="yellow">
            Choose an action:
          </Text>
          <Box marginTop={0.5}>
            <Text color="green" bold>[Y] Approve Command</Text>
            <Text>  |  </Text>
            <Text color="red" bold>[N] Block & Abort</Text>
            <Text>  |  </Text>
            <Text color="magenta" bold>[R] Rollback Workspace Changes</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">Waiting for developer input... </Text>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          {decision === 'approved' && (
            <Text color="green" bold>
              ✓ APPROVED: Spawning process execution.
            </Text>
          )}
          {decision === 'blocked' && (
            <Text color="red" bold>
              ❌ BLOCKED: Aborting workflow execution.
            </Text>
          )}
          {decision === 'rolled_back' && (
            <Text color="magenta" bold>
              ⚙ ROLLED BACK: Engaging checkout snap restoring files.
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}
