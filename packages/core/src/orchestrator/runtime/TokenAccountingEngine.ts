/**
 * MetaCLI Core — Token Accounting Engine
 *
 * Centralized token accounting manager tracking cumulative input/output token usage
 * and estimated dollar costs per provider, session, project, and workflow.
 */

export interface TokenUsageRecord {
  providerId: string;
  sessionId: string;
  projectPath: string;
  workflowId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
}

export class TokenAccountingEngine {
  // Estimated cost per 1M tokens (e.g. Claude 3.5 Sonnet, Gemini 1.5 Flash, etc.)
  private static rates: Record<string, { input: number; output: number }> = {
    'claude-code': { input: 3.0, output: 15.0 },
    'gemini-cli': { input: 0.075, output: 0.30 },
    'codex-cli': { input: 1.5, output: 2.0 },
    'opencode-cli': { input: 1.0, output: 3.0 },
  };

  private records: TokenUsageRecord[] = [];

  constructor() {}

  /**
   * Record a new transaction chunk.
   */
  public recordUsage(
    providerId: string,
    sessionId: string,
    projectPath: string,
    workflowId: string,
    inputTokens: number,
    outputTokens: number
  ): TokenUsageRecord {
    const rate = TokenAccountingEngine.rates[providerId] || { input: 1.5, output: 5.0 };
    const cost = (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;

    const record: TokenUsageRecord = {
      providerId,
      sessionId,
      projectPath,
      workflowId,
      inputTokens,
      outputTokens,
      cost,
      timestamp: new Date(),
    };

    this.records.push(record);
    return record;
  }

  public getStatsForProvider(providerId: string) {
    return this.aggregate(this.records.filter((r) => r.providerId === providerId));
  }

  public getStatsForSession(sessionId: string) {
    return this.aggregate(this.records.filter((r) => r.sessionId === sessionId));
  }

  public getStatsForProject(projectPath: string) {
    return this.aggregate(this.records.filter((r) => r.projectPath === projectPath));
  }

  public getStatsForWorkflow(workflowId: string) {
    return this.aggregate(this.records.filter((r) => r.workflowId === workflowId));
  }

  public getGlobalStats() {
    return this.aggregate(this.records);
  }

  private aggregate(records: TokenUsageRecord[]) {
    return records.reduce(
      (acc, record) => {
        acc.inputTokens += record.inputTokens;
        acc.outputTokens += record.outputTokens;
        acc.totalTokens += record.inputTokens + record.outputTokens;
        acc.cost += record.cost;
        return acc;
      },
      { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 }
    );
  }

  public loadRecords(records: TokenUsageRecord[]): void {
    this.records = [...records];
  }

  public getAllRecords(): TokenUsageRecord[] {
    return this.records;
  }
}
