/**
 * MetaCLI Core — Live Engineering Monitor
 *
 * Continuous background observer: tracks coupling growth, stale modules,
 * risky changes, and architectural drift. Emits proactive warnings before
 * problems become incidents. Debounced to avoid hammering on active edits.
 */

import type { EventBus } from '../events/EventBus.js';
import type { MetaCLIEvents } from '../events/events.js';

export interface EngineeringHealthMetrics {
  overallScore: number;      // 0–100
  couplingIndex: number;     // 0–100 (lower is better)
  staleModuleCount: number;
  recentRiskyChanges: number;
  lastAnalyzedAt: number;
}

export interface RiskAlert {
  severity: 'low' | 'medium' | 'high';
  message: string;
  affectedModules: string[];
  timestamp: number;
}

export interface MonitorConfig {
  intervalMs: number;        // analysis cadence
  couplingWarningThreshold: number;
  staleModuleWarningThreshold: number;
  riskyChangesWarningThreshold: number;
}

const DEFAULT_CONFIG: MonitorConfig = {
  intervalMs: 60_000,
  couplingWarningThreshold: 60,
  staleModuleWarningThreshold: 5,
  riskyChangesWarningThreshold: 3,
};

export class LiveEngineeringMonitor {
  private metrics: EngineeringHealthMetrics = {
    overallScore: 100,
    couplingIndex: 0,
    staleModuleCount: 0,
    recentRiskyChanges: 0,
    lastAnalyzedAt: 0,
  };

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly config: MonitorConfig;
  private analyzer: (() => Promise<Partial<EngineeringHealthMetrics>>) | null = null;

  constructor(
    private readonly __eventBus?: EventBus<MetaCLIEvents>,
    config: Partial<MonitorConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public registerAnalyzer(fn: () => Promise<Partial<EngineeringHealthMetrics>>): void {
    this.analyzer = fn;
  }

  public startMonitoring(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.runAnalysis(), this.config.intervalMs);
    // Run once immediately on start
    void this.runAnalysis();
  }

  public stopMonitoring(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getHealth(): EngineeringHealthMetrics {
    return { ...this.metrics };
  }

  public forceAnalysis(): Promise<void> {
    return this.runAnalysis();
  }

  // ─── Private ─────────────────────────────────────────────────────

  private async runAnalysis(): Promise<void> {
    try {
      const fresh = this.analyzer ? await this.analyzer() : {};
      this.applyMetrics(fresh);

      this.metrics.lastAnalyzedAt = Date.now();
      this.metrics.overallScore = this.computeScore();

      await this.emitHealthUpdate();
      await this.checkAlerts();
    } catch {
      // Monitor failures are non-fatal; next tick will retry
    }
  }

  private applyMetrics(partial: Partial<EngineeringHealthMetrics>): void {
    if (partial.couplingIndex !== undefined) this.metrics.couplingIndex = partial.couplingIndex;
    if (partial.staleModuleCount !== undefined) this.metrics.staleModuleCount = partial.staleModuleCount;
    if (partial.recentRiskyChanges !== undefined) this.metrics.recentRiskyChanges = partial.recentRiskyChanges;
  }

  private computeScore(): number {
    const couplingPenalty = Math.min(50, this.metrics.couplingIndex * 0.5);
    const stalePenalty = Math.min(20, this.metrics.staleModuleCount * 2);
    const riskyPenalty = Math.min(30, this.metrics.recentRiskyChanges * 5);
    return Math.max(0, 100 - couplingPenalty - stalePenalty - riskyPenalty);
  }

  private async emitHealthUpdate(): Promise<void> {
    await this.__eventBus?.emit('system:error' as any, {
      error: `[HealthMonitor] Score: ${this.metrics.overallScore} | Coupling: ${this.metrics.couplingIndex} | Stale: ${this.metrics.staleModuleCount}`,
      fatal: false,
    });
  }

  private async checkAlerts(): Promise<void> {
    const alerts: RiskAlert[] = [];

    if (this.metrics.couplingIndex >= this.config.couplingWarningThreshold) {
      alerts.push({
        severity: this.metrics.couplingIndex >= 80 ? 'high' : 'medium',
        message: `Coupling index is ${this.metrics.couplingIndex} — architectural debt accumulating`,
        affectedModules: [],
        timestamp: Date.now(),
      });
    }

    if (this.metrics.staleModuleCount >= this.config.staleModuleWarningThreshold) {
      alerts.push({
        severity: 'low',
        message: `${this.metrics.staleModuleCount} stale modules detected`,
        affectedModules: [],
        timestamp: Date.now(),
      });
    }

    if (this.metrics.recentRiskyChanges >= this.config.riskyChangesWarningThreshold) {
      alerts.push({
        severity: 'high',
        message: `${this.metrics.recentRiskyChanges} high-risk changes in recent commits`,
        affectedModules: [],
        timestamp: Date.now(),
      });
    }

    for (const alert of alerts) {
      await this.__eventBus?.emit('system:error' as any, {
        error: `[LiveMonitor:${alert.severity.toUpperCase()}] ${alert.message}`,
        fatal: false,
      });
    }
  }
}
