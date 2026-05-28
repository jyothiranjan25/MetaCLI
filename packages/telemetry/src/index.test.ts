import { describe, it, expect } from 'vitest';
import { BrainTelemetry } from './index.js';

describe('MetaCLI Brain Telemetry', () => {
  it('should record semantic search logs, calculate average precision ratios, and track cache hit rates', () => {
    const telemetry = new BrainTelemetry();
    
    // 1. Record metrics
    telemetry.recordRetrieval({ latencyMs: 50, precision: 1.0, cacheHit: true });
    telemetry.recordRetrieval({ latencyMs: 150, precision: 0.8, cacheHit: false });
    
    // 2. Report validation
    const report = telemetry.getReport();
    expect(report.totalSearches).toBe(2);
    expect(report.averageLatencyMs).toBe(100);
    expect(report.averagePrecision).toBe(0.9);
    expect(report.cacheHitRatio).toBe(0.5);
  });
});
