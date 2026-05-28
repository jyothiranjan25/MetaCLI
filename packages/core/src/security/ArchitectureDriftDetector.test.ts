import { describe, it, expect } from 'vitest';
import { ArchitectureDriftDetector, type ArchitectureRule } from './ArchitectureDriftDetector.js';

describe('ArchitectureDriftDetector (Modularity Guard)', () => {
  it('should successfully match wildcards and report modularity violations', () => {
    const rules: ArchitectureRule[] = [
      {
        id: 'rule-ui-db',
        sourceModulePattern: 'src/ui/*',
        targetModulePattern: 'src/db/*',
        allowDependency: false,
      },
      {
        id: 'rule-view-persistence',
        sourceModulePattern: 'src/views/**',
        targetModulePattern: 'src/persistence/**',
        allowDependency: false,
      },
    ];

    const detector = new ArchitectureDriftDetector(rules);

    // 1. Direct match UI to DB (single asterisk *)
    const deps1 = [
      { sourcePath: 'src/ui/Button.ts', targetPath: 'src/db/DatabaseService.ts' },
    ];
    const violations1 = detector.checkDrifts(deps1);
    expect(violations1.length).toBe(1);
    expect(violations1[0].ruleId).toBe('rule-ui-db');
    expect(violations1[0].reason).toContain('boundary violation');

    // 2. Subdir UI components should NOT match single asterisk *
    const deps2 = [
      { sourcePath: 'src/ui/components/Button.ts', targetPath: 'src/db/DatabaseService.ts' },
    ];
    const violations2 = detector.checkDrifts(deps2);
    expect(violations2.length).toBe(0); // single depth wildcard * does not match multiple subdirectories

    // 3. View components should match recursive asterisk **
    const deps3 = [
      { sourcePath: 'src/views/admin/dashboard/View.ts', targetPath: 'src/persistence/sqlite/SQLiteDriver.ts' },
    ];
    const violations3 = detector.checkDrifts(deps3);
    expect(violations3.length).toBe(1);
    expect(violations3[0].ruleId).toBe('rule-view-persistence');

    // 4. Non-matching dependencies should pass cleanly
    const deps4 = [
      { sourcePath: 'src/ui/Button.ts', targetPath: 'src/ui/Icon.ts' },
      { sourcePath: 'src/db/DatabaseService.ts', targetPath: 'src/persistence/sqlite/SQLiteDriver.ts' },
    ];
    const violations4 = detector.checkDrifts(deps4);
    expect(violations4.length).toBe(0);
  });

  it('should support dynamic rule updates using setRules', () => {
    const detector = new ArchitectureDriftDetector();

    const deps = [
      { sourcePath: 'src/controllers/UserController.ts', targetPath: 'src/views/UserView.ts' },
    ];

    // No rules active initially
    expect(detector.checkDrifts(deps).length).toBe(0);

    // Set rule to block Controller -> View imports
    detector.setRules([
      {
        id: 'rule-controller-view',
        sourceModulePattern: 'src/controllers/*',
        targetModulePattern: 'src/views/*',
        allowDependency: false,
      },
    ]);

    const violations = detector.checkDrifts(deps);
    expect(violations.length).toBe(1);
    expect(violations[0].ruleId).toBe('rule-controller-view');
  });
});
