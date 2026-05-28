/**
 * MetaCLI CLI — `audit` Command
 *
 * Formats and reports Relational Execution Audits from the SQLite database
 * as premium terminal tabular summaries.
 */

import path from 'node:path';
import fs from 'node:fs';
import { BrainStore } from '@metacli/brain';
import { findProjectRoot } from '../bootstrap.js';

interface AuditCommandOptions {
  dir: string;
  limit?: number;
}

export async function auditCommand(options: AuditCommandOptions): Promise<void> {
  const resolvedDir = findProjectRoot(options.dir);
  const dbPath = path.join(resolvedDir, '.metacli', 'brain.db');

  if (!fs.existsSync(dbPath)) {
    console.log('\n📋 No execution audit database discovered. Run a workflow or command first!\n');
    return;
  }

  try {
    const store = new BrainStore(resolvedDir);
    const audits = store.getAllExecutionAudits();
    store.close();

    if (audits.length === 0) {
      console.log('\n📋 No execution audits logged yet. Safety boundaries are pristine!\n');
      return;
    }

    const limit = options.limit ?? 20;
    const records = audits.slice(0, limit);

    console.log(`\n🛡◆ MetaCLI Relational Security Audit Trail (Last ${records.length} executions):\n`);

    // Define table columns
    const colWidths = {
      time: 20,
      cmd: 25,
      risk: 8,
      approved: 13,
      status: 12,
      duration: 8,
    };

    // Print headers
    const header =
      'TIMESTAMP'.padEnd(colWidths.time) +
      ' | ' +
      'COMMAND'.padEnd(colWidths.cmd) +
      ' | ' +
      'RISK'.padEnd(colWidths.risk) +
      ' | ' +
      'APPROVED BY'.padEnd(colWidths.approved) +
      ' | ' +
      'STATUS'.padEnd(colWidths.status) +
      ' | ' +
      'DUR(MS)';

    console.log('\x1b[1m\x1b[36m' + header + '\x1b[0m');
    console.log('\x1b[90m' + '─'.repeat(header.length) + '\x1b[0m');

    for (const r of records) {
      const timeStr = r.timestamp ? r.timestamp.slice(0, 19).replace('T', ' ') : 'unknown';
      
      // Clean command display string
      let cmdStr = r.command;
      if (cmdStr.length > colWidths.cmd) {
        cmdStr = cmdStr.slice(0, colWidths.cmd - 3) + '...';
      }

      // Risk Hues
      let riskStr = r.riskLevel.toUpperCase();
      if (r.riskLevel === 'high') {
        riskStr = '\x1b[31m\x1b[1m' + riskStr.padEnd(colWidths.risk) + '\x1b[0m';
      } else if (r.riskLevel === 'medium') {
        riskStr = '\x1b[33m' + riskStr.padEnd(colWidths.risk) + '\x1b[0m';
      } else {
        riskStr = '\x1b[32m' + riskStr.padEnd(colWidths.risk) + '\x1b[0m';
      }

      // Status Hues
      let statusStr = r.status.toUpperCase();
      if (r.status === 'success') {
        statusStr = '\x1b[32m✓ ' + statusStr.padEnd(colWidths.status - 2) + '\x1b[0m';
      } else if (r.status === 'failed') {
        statusStr = '\x1b[31m❌ ' + statusStr.padEnd(colWidths.status - 2) + '\x1b[0m';
      } else if (r.status === 'rolled_back') {
        statusStr = '\x1b[35m⚙ ' + statusStr.padEnd(colWidths.status - 2) + '\x1b[0m';
      } else {
        statusStr = '\x1b[33m⏳ ' + statusStr.padEnd(colWidths.status - 2) + '\x1b[0m';
      }

      const durStr = r.durationMs !== undefined ? `${r.durationMs}` : '-';

      const row =
        timeStr.padEnd(colWidths.time) +
        ' | ' +
        cmdStr.padEnd(colWidths.cmd) +
        ' | ' +
        riskStr +
        ' | ' +
        r.approvedBy.padEnd(colWidths.approved) +
        ' | ' +
        statusStr +
        ' | ' +
        durStr.padEnd(colWidths.duration);

      console.log(row);
    }
    
    console.log(`\n• Total unique operations audited: ${audits.length}\n`);
  } catch (error) {
    console.error('❌ Audit Command Error:', error instanceof Error ? error.message : String(error));
  }
}
