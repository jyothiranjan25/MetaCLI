/**
 * MetaCLI Core — Confidence-Gated Retrieval
 *
 * Before reading any file, checks the confidence score of existing semantic
 * knowledge. If confidence exceeds the threshold the cached semantic data is
 * returned directly. Only changed or low-confidence files trigger actual reads.
 * Confidence degrades on file-change events.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export interface FileConfidence {
  filePath: string;
  score: number;            // 0–1
  lastConfirmedAt: number;
  contentHash: string;
  semanticSummary?: string;
}

export interface GatedRetrievalRequest {
  filePaths: string[];
  confidenceThreshold?: number; // default 0.8
}

export interface GatedRetrievalResult {
  served: Array<{ filePath: string; summary: string; fromCache: true }>;
  needsRead: string[];
  skippedCount: number;
}

export class ConfidenceGatedRetrieval {
  private readonly confidence = new Map<string, FileConfidence>();
  private readonly DEFAULT_THRESHOLD = 0.8;

  constructor(private readonly __eventBus?: EventBus<MetaCLIEvents>) {
    if (this.__eventBus) this.bindDegradation();
  }

  private bindDegradation(): void {
    // When the workspace rescans, mark all files as needing re-validation
    this.__eventBus!.on('brain:scan_start', () => {
      for (const entry of this.confidence.values()) {
        entry.score = Math.min(entry.score, 0.5); // partial degradation
      }
    });
  }

  /**
   * Record that we have high-confidence semantic knowledge for a file.
   */
  public recordConfidence(filePath: string, summary: string, contentHash: string, score = 1.0): void {
    this.confidence.set(filePath, {
      filePath,
      score,
      lastConfirmedAt: Date.now(),
      contentHash,
      semanticSummary: summary,
    });
  }

  /**
   * Degrade confidence when a file is known to have changed.
   */
  public degradeConfidence(filePath: string, newContentHash?: string): void {
    const existing = this.confidence.get(filePath);
    if (!existing) return;

    if (newContentHash && newContentHash !== existing.contentHash) {
      // Hash changed — confidence drops to near zero
      existing.score = 0.1;
      existing.contentHash = newContentHash;
    } else {
      // Time-based degradation (1% per minute stale)
      const ageMins = (Date.now() - existing.lastConfirmedAt) / 60_000;
      existing.score = Math.max(0.1, existing.score - ageMins * 0.01);
    }
  }

  /**
   * Gate a batch of file paths: return cached summaries for high-confidence
   * files and identify which files actually need to be read.
   */
  public gate(request: GatedRetrievalRequest): GatedRetrievalResult {
    const threshold = request.confidenceThreshold ?? this.DEFAULT_THRESHOLD;
    const served: GatedRetrievalResult['served'] = [];
    const needsRead: string[] = [];

    for (const filePath of request.filePaths) {
      const conf = this.confidence.get(filePath);

      if (conf && conf.score >= threshold && conf.semanticSummary) {
        served.push({ filePath, summary: conf.semanticSummary, fromCache: true });
      } else {
        needsRead.push(filePath);
      }
    }

    return { served, needsRead, skippedCount: served.length };
  }

  public getConfidence(filePath: string): number {
    return this.confidence.get(filePath)?.score ?? 0;
  }

  public getConfidenceMap(): Map<string, FileConfidence> {
    return new Map(this.confidence);
  }

  public clearAll(): void {
    this.confidence.clear();
  }
}
