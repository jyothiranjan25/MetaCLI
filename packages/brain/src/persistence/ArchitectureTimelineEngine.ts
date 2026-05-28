/**
 * @metacli/brain — Architecture Timeline Engine
 *
 * Persists high-level architecture decisions, migrations, dependency transitions,
 * and design intent chronologies inside the brain database footprint.
 */

export interface ArchitectureDecision {
  id: string;
  timestamp: string;
  system: string;
  decision: string;
  rationale: string;
}

export class ArchitectureTimelineEngine {
  private store: any;

  constructor(store: any) {
    this.store = store;
  }

  /**
   * Persists an architectural decision snapshot inside the relational db.
   */
  recordDecision(decision: Omit<ArchitectureDecision, 'id' | 'timestamp'>): void {
    const id = `decision-${Math.random().toString(36).substring(2, 11)}`;
    
    this.store.saveMemory({
      id,
      layer: 'cold',
      content: `System: [${decision.system}] Decision: ${decision.decision}. Rationale: ${decision.rationale}`,
      metadata: JSON.stringify({
        type: 'architecture_decision',
        system: decision.system,
        decision: decision.decision,
        rationale: decision.rationale,
      }),
    });
  }

  /**
   * Retrieves the entire history of design timelines.
   */
  getTimeline(): ArchitectureDecision[] {
    const records = this.store.getMemoriesByLayer('cold');
    const timeline: ArchitectureDecision[] = [];

    for (const rec of records) {
      if (rec.metadata) {
        try {
          const parsed = JSON.parse(rec.metadata);
          if (parsed.type === 'architecture_decision') {
            timeline.push({
              id: rec.id,
              timestamp: rec.timestamp || new Date().toISOString(),
              system: parsed.system,
              decision: parsed.decision,
              rationale: parsed.rationale,
            });
          }
        } catch {
          // Skip malformed metadata records
        }
      }
    }

    return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}
