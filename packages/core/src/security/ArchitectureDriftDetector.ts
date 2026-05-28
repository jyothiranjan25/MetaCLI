/**
 * MetaCLI Core — Architecture Drift Detector
 *
 * Implements real-time analysis of codebase structural rules (modular boundaries)
 * based on dynamic wildcard dependency matchers.
 */

export interface ArchitectureRule {
  id: string;
  sourceModulePattern: string; // e.g., 'packages/core/src/ui/**' or 'src/ui/*'
  targetModulePattern: string; // e.g., 'packages/brain/src/**' or 'src/db/*'
  allowDependency: boolean;    // false to block/lint
}

export interface DriftViolation {
  id: string;
  sourcePath: string;
  targetPath: string;
  ruleId: string;
  reason: string;
}

export interface DependencyLike {
  sourcePath: string;
  targetPath: string;
}

export class ArchitectureDriftDetector {
  private rules: ArchitectureRule[] = [];

  constructor(rules: ArchitectureRule[] = []) {
    this.rules = rules;
  }

  /**
   * Set the active architectural linting rules.
   */
  setRules(rules: ArchitectureRule[]): void {
    this.rules = rules;
  }

  /**
   * Evaluate dynamic module couplings and identify architectural drifts.
   * Returns a list of violations.
   */
  checkDrifts(dependencies: DependencyLike[]): DriftViolation[] {
    const violations: DriftViolation[] = [];

    for (const dep of dependencies) {
      for (const rule of this.rules) {
        const matchesSource = this.match(dep.sourcePath, rule.sourceModulePattern);
        const matchesTarget = this.match(dep.targetPath, rule.targetModulePattern);

        if (matchesSource && matchesTarget && !rule.allowDependency) {
          violations.push({
            id: `violation-${Math.random().toString(36).substring(2, 11)}`,
            sourcePath: dep.sourcePath,
            targetPath: dep.targetPath,
            ruleId: rule.id,
            reason: `Architectural boundary violation: "${dep.sourcePath}" imports "${dep.targetPath}" (Blocked by rule: "${rule.id}")`,
          });
        }
      }
    }

    return violations;
  }

  /**
   * Translates wildcard/glob syntax into strict regular expressions for path mapping.
   */
  private match(pathStr: string, pattern: string): boolean {
    // Clean up directory slashes for consistency
    const normalizedPath = pathStr.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');

    const escaped = normalizedPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    let regexStr = escaped.replace(/\*\*/g, '.*');
    regexStr = regexStr.replace(/(?<!\.)\*/g, '[^/]*');
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(normalizedPath);
  }
}
