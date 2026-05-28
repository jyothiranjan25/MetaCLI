export type OutputDensityMode =
  | 'diff-only'
  | 'patch-only'
  | 'concise-summary'
  | 'architecture-summary'
  | 'explanation-minimal'
  | 'verbose-debug';

export class OutputDensityController {
  directive(mode: OutputDensityMode): string {
    switch (mode) {
      case 'diff-only':
        return 'Output only the diff or exact changed hunks.';
      case 'patch-only':
        return 'Output only the patch or implementation result, with no extra narrative.';
      case 'concise-summary':
        return 'Output a concise engineering summary plus any verification details.';
      case 'architecture-summary':
        return 'Output architecture-level reasoning with terse implementation implications.';
      case 'explanation-minimal':
        return 'Output minimal explanation focused only on necessary decisions.';
      case 'verbose-debug':
        return 'Output detailed debugging reasoning, but avoid repeating context.';
    }
  }
}
