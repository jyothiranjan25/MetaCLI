export type RiskLevel = 'low' | 'medium' | 'high';

export interface CommandRisk {
  level: RiskLevel;
  reason: string;
  requiresGitCheckpoint: boolean;
}

export class CommandAnalyzer {
  private denylist: string[];
  private allowedPrefixes: string[];

  constructor(config?: { allowed?: string[]; denied?: string[] }) {
    this.denylist = config?.denied ?? [
      'rm -rf /', 
      'sudo rm', 
      'shutdown', 
      'init 0', 
      'poweroff', 
      'reboot',
      'mkfs', 
      'dd if=', 
      'chmod -R 777', 
      'chown', 
      'passwd', 
      'crontab -r',
      'mv * /dev/null', 
      ':(){ :|:& };:', 
      '> /dev/sda'
    ];

    this.allowedPrefixes = config?.allowed ?? [
      'npm install', 'npm test', 'npm run test', 'npm run lint', 'npm run format',
      'pnpm install', 'pnpm test', 'pnpm run test', 'pnpm lint', 'pnpm format', 'pnpm run lint', 'pnpm run format',
      'yarn install', 'yarn test', 'yarn lint', 'yarn format',
      'git status', 'git diff', 'git log', 'git show', 'git branch',
      'cargo build', 'cargo test', 'cargo check', 'cargo run',
      'pytest', 'vitest', 'tsc', 'eslint', 'prettier',
      'go test', 'go build', 'go run'
    ];
  }


  /**
   * Statically analyze a command string to compute its risk profile.
   */
  analyze(command: string): CommandRisk {
    const cleaned = command.trim().toLowerCase();

    // 1. Strict Denylist Check
    for (const dangerous of this.denylist) {
      if (cleaned.includes(dangerous.toLowerCase())) {
        return {
          level: 'high',
          reason: `Command contains explicitly banned hazardous pattern: "${dangerous}"`,
          requiresGitCheckpoint: true,
        };
      }
    }

    // 2. High-Risk Command Detections (Superuser or external downloads)
    if (
      cleaned.startsWith('sudo ') || 
      cleaned.includes('sudo ') ||
      cleaned.includes('curl ') || 
      cleaned.includes('wget ') ||
      cleaned.includes('sh -c') || 
      cleaned.includes('bash -c')
    ) {
      return {
        level: 'high',
        reason: 'Command attempts superuser access, external resource downloads, or nested shell executions.',
        requiresGitCheckpoint: true,
      };
    }

    // 3. Medium-Risk Command Detections (Database writes or destructive changes)
    if (
      cleaned.includes('migrate') || 
      cleaned.includes('push') || 
      cleaned.includes('upgrade') || 
      cleaned.includes('checkout ') || 
      cleaned.includes('branch -d') ||
      cleaned.includes('rm ') || 
      cleaned.includes('delete ')
    ) {
      return {
        level: 'medium',
        reason: 'Command alters database schemas, dependency chains, git branches, or deletes files.',
        requiresGitCheckpoint: true,
      };
    }

    // 4. Low-Risk Whitelist Auto-Approvals
    const isWhitelisted = this.allowedPrefixes.some(prefix => cleaned.startsWith(prefix));
    if (isWhitelisted) {
      return {
        level: 'low',
        reason: 'Command belongs to configured zero-friction developer whitelist.',
        requiresGitCheckpoint: false,
      };
    }

    // 5. Default Unrecognized Command
    return {
      level: 'high',
      reason: 'Command unrecognized by developer whitelists. Flagged dynamically.',
      requiresGitCheckpoint: true,
    };
  }
}
