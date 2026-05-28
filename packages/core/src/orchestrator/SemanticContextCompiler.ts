import type { ContextItem } from './ContextOptimizer.js';
import { IntentClassifier, type IntentClassification } from './IntentClassifier.js';
import { ProviderTokenProfiles } from './ProviderTokenProfiles.js';
import { RetrievalValueRanker, type RetrievalValueSignals, type RankedContextItem } from './RetrievalValueRanker.js';
import { IntentContextReducer } from './IntentContextReducer.js';
import { ContextDeduplicator } from './ContextDeduplicator.js';
import { HierarchicalCompressionRuntime, type ContextDetailLevel } from './HierarchicalCompressionRuntime.js';
import { TokenBudgetAllocator } from './TokenBudgetAllocator.js';
import { PromptShapeOptimizer } from './PromptShapeOptimizer.js';
import { OutputDensityController, type OutputDensityMode } from './OutputDensityController.js';

export interface SemanticContextCompilerOptions {
  providerId: string;
  contextItems: ContextItem[];
  valueSignals?: Map<string, RetrievalValueSignals>;
  maxTokens?: number;
  detailLevel?: ContextDetailLevel;
  outputMode?: OutputDensityMode;
}

export interface CompiledSemanticContext {
  providerId: string;
  intent: IntentClassification;
  prompt: string;
  systemInstructions: string;
  selectedItems: RankedContextItem[];
  droppedPaths: string[];
  estimatedTokens: number;
  tokensSaved: number;
  compressionLevel: ContextDetailLevel;
  dedupeReferences: Array<{ keptPath: string; duplicatePath: string; reason: string }>;
}

export class SemanticContextCompiler {
  private readonly intentClassifier: IntentClassifier;
  private readonly profiles: ProviderTokenProfiles;
  private readonly ranker = new RetrievalValueRanker();
  private readonly reducer = new IntentContextReducer();
  private readonly deduplicator = new ContextDeduplicator();
  private readonly compressor = new HierarchicalCompressionRuntime();
  private readonly allocator = new TokenBudgetAllocator();
  private readonly shaper = new PromptShapeOptimizer();
  private readonly outputDensity = new OutputDensityController();

  constructor(eventBus?: any, intentClassifier?: IntentClassifier, profiles?: ProviderTokenProfiles) {
    this.intentClassifier = intentClassifier ?? new IntentClassifier(eventBus);
    this.profiles = profiles ?? new ProviderTokenProfiles();
  }

  async compile(userPrompt: string, options: SemanticContextCompilerOptions): Promise<CompiledSemanticContext> {
    const profile = this.profiles.get(options.providerId);
    const intent = await this.intentClassifier.classify(userPrompt);
    const reduced = this.reducer.reduce(options.contextItems, intent.primaryIntent);
    const ranked = this.ranker.rank(reduced.items, options.valueSignals);
    const deduped = this.deduplicator.dedupe(ranked);
    const targetTokens = options.maxTokens ?? profile.targetInputTokens;
    const compressed = this.compressor.compress(deduped.items, Math.floor(targetTokens * profile.compressionRatio), options.detailLevel);
    const allocated = this.allocator.allocate(compressed.items, {
      maxTokens: Math.min(profile.maxInputTokens, targetTokens),
      reserveTokens: profile.reserveOutputTokens,
    });
    const denseContext = this.formatDenseContext(allocated.selected, compressed.summary, allocated.dropped.map((item) => item.path));
    const outputMode = options.outputMode ?? profile.responseMode;
    const shaped = this.shaper.shape(userPrompt, denseContext, profile, this.outputDensity.directive(outputMode));

    return {
      providerId: options.providerId,
      intent,
      prompt: shaped.prompt,
      systemInstructions: shaped.systemInstructions,
      selectedItems: allocated.selected as RankedContextItem[],
      droppedPaths: allocated.dropped.map((item) => item.path),
      estimatedTokens: shaped.estimatedTokens,
      tokensSaved: reduced.tokensSaved + deduped.tokensSaved + compressed.tokensSaved + allocated.tokensSaved,
      compressionLevel: compressed.level,
      dedupeReferences: deduped.references,
    };
  }

  private formatDenseContext(selected: ContextItem[], compressedSummary: string, droppedPaths: string[]): string {
    const selectedBlock = selected.map((item) => `### ${item.path}\n${item.content}`).join('\n\n');
    const dropped = droppedPaths.length > 0 ? `\n\nOmitted low-value context: ${droppedPaths.slice(0, 20).join(', ')}` : '';
    return `${selectedBlock || compressedSummary}${dropped}`.trim();
  }
}
