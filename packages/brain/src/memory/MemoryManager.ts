/**
 * MetaCLI Brain — Memory Manager
 *
 * Coordinates three tiers of agent session memory:
 * - Hot Memory: active chat session turns and state.
 * - Warm Memory: recent workspace milestones, code summaries, and context.
 * - Cold Memory: long-term compressed project maps and architectural rules.
 *
 * Persists relational-style inside SQLite and provides semantic cosine similarity
 * + robust fallback keyword-based matching retrieval.
 */

import { randomUUID } from 'node:crypto';
import type { BrainStore, MemoryRecord } from '../persistence/BrainStore.js';

export class MemoryManager {
  constructor(private store: BrainStore) {}

  /**
   * Add a new memory record to a specific partition layer.
   */
  addMemory(
    layer: 'hot' | 'warm' | 'cold',
    content: string,
    options: {
      summary?: string;
      embedding?: number[];
      metadata?: Record<string, any>;
    } = {},
  ): string {
    const id = randomUUID();
    const memory: MemoryRecord = {
      id,
      layer,
      content,
      summary: options.summary,
      embedding: options.embedding ? JSON.stringify(options.embedding) : undefined,
      metadata: options.metadata ? JSON.stringify(options.metadata) : undefined,
    };

    this.store.saveMemory(memory);
    return id;
  }

  /**
   * Retrieve all raw memories in a partition layer, sorted by date (newest first).
   */
  getMemories(layer: 'hot' | 'warm' | 'cold'): MemoryRecord[] {
    return this.store.getMemoriesByLayer(layer);
  }

  /**
   * Clear all memories from a partition layer.
   */
  clearMemories(layer: 'hot' | 'warm' | 'cold'): void {
    this.store.clearMemoriesByLayer(layer);
  }

  /**
   * Retrieve relevant memories from the database matching a search prompt.
   * Leverages Cosine Similarity if a vector embedding is provided,
   * falling back to dynamic token keyword relevance matching.
   */
  searchMemories(
    query: string,
    options: {
      layer?: 'hot' | 'warm' | 'cold';
      queryEmbedding?: number[];
      limit?: number;
    } = {},
  ): MemoryRecord[] {
    const limit = options.limit ?? 10;
    const layers: ('hot' | 'warm' | 'cold')[] = options.layer
      ? [options.layer]
      : ['hot', 'warm', 'cold'];

    // 1. Gather all memories from target layers
    const candidates: MemoryRecord[] = [];
    for (const l of layers) {
      candidates.push(...this.store.getMemoriesByLayer(l));
    }

    if (candidates.length === 0) return [];

    // 2. Score candidates
    interface ScoredCandidate {
      memory: MemoryRecord;
      score: number;
    }

    const scored: ScoredCandidate[] = [];

    if (options.queryEmbedding && options.queryEmbedding.length > 0) {
      // Vector Mode: Cosine Similarity
      const queryVec = options.queryEmbedding;

      for (const cand of candidates) {
        if (!cand.embedding) {
          // No vector on candidate: fallback to simple text score
          const textScore = this.calculateTextRelevance(cand.content, query);
          scored.push({ memory: cand, score: textScore * 0.1 }); // lower weight than direct vectors
          continue;
        }

        try {
          const candVec = JSON.parse(cand.embedding) as number[];
          const sim = this.cosineSimilarity(queryVec, candVec);
          scored.push({ memory: cand, score: sim });
        } catch {
          scored.push({ memory: cand, score: 0 });
        }
      }
    } else {
      // Fallback Mode: Token/Keyword relevance scoring
      for (const cand of candidates) {
        const score = this.calculateTextRelevance(cand.content, query);
        scored.push({ memory: cand, score });
      }
    }

    // 3. Sort descending and limit
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.memory);
  }

  // ─── Private Mathematics & Retrieval Heuristics ──────────────

  /**
   * Calculate traditional cosine similarity between two vector lists.
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i]! * vecB[i]!;
      normA += vecA[i]! * vecA[i]!;
      normB += vecB[i]! * vecB[i]!;
    }

    const magA = Math.sqrt(normA);
    const magB = Math.sqrt(normB);

    if (magA === 0 || magB === 0) return 0;

    return dotProduct / (magA * magB);
  }

  /**
   * Evaluates text search relevance based on intersection of case-insensitive word tokens.
   */
  private calculateTextRelevance(content: string, query: string): number {
    const tokenize = (text: string): Set<string> => {
      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2); // ignore small pronouns/articles
      return new Set(words);
    };

    const queryTokens = tokenize(query);
    const contentTokens = tokenize(content);

    if (queryTokens.size === 0) return 0;

    let matches = 0;
    for (const token of queryTokens) {
      if (contentTokens.has(token)) {
        matches++;
      }
    }

    return matches / queryTokens.size;
  }
}
