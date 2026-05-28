export type ProviderId = 'claude' | 'gemini' | 'codex' | 'opencode' | string;

export interface ProviderTokenProfile {
  providerId: ProviderId;
  maxInputTokens: number;
  targetInputTokens: number;
  reserveOutputTokens: number;
  preferredStructure: 'xml' | 'markdown' | 'json' | 'plain';
  retrievalDepth: number;
  compressionRatio: number;
  responseMode: 'diff-only' | 'patch-only' | 'concise-summary' | 'architecture-summary' | 'explanation-minimal' | 'verbose-debug';
}

const BASE_PROFILES: Record<string, ProviderTokenProfile> = {
  claude: {
    providerId: 'claude',
    maxInputTokens: 200_000,
    targetInputTokens: 24_000,
    reserveOutputTokens: 4_000,
    preferredStructure: 'xml',
    retrievalDepth: 3,
    compressionRatio: 0.35,
    responseMode: 'concise-summary',
  },
  gemini: {
    providerId: 'gemini',
    maxInputTokens: 1_000_000,
    targetInputTokens: 32_000,
    reserveOutputTokens: 4_000,
    preferredStructure: 'json',
    retrievalDepth: 3,
    compressionRatio: 0.3,
    responseMode: 'concise-summary',
  },
  codex: {
    providerId: 'codex',
    maxInputTokens: 16_000,
    targetInputTokens: 6_000,
    reserveOutputTokens: 2_000,
    preferredStructure: 'markdown',
    retrievalDepth: 1,
    compressionRatio: 0.55,
    responseMode: 'patch-only',
  },
  opencode: {
    providerId: 'opencode',
    maxInputTokens: 32_000,
    targetInputTokens: 10_000,
    reserveOutputTokens: 2_500,
    preferredStructure: 'plain',
    retrievalDepth: 2,
    compressionRatio: 0.45,
    responseMode: 'patch-only',
  },
};

export class ProviderTokenProfiles {
  private readonly overrides = new Map<string, Partial<ProviderTokenProfile>>();

  get(providerId: ProviderId): ProviderTokenProfile {
    const normalized = String(providerId).toLowerCase();
    const key = Object.keys(BASE_PROFILES).find((id) => normalized.includes(id));
    const base = key ? BASE_PROFILES[key] : BASE_PROFILES.codex;
    return { ...base, providerId, ...(this.overrides.get(String(providerId)) ?? {}) };
  }

  setOverride(providerId: ProviderId, override: Partial<ProviderTokenProfile>): void {
    this.overrides.set(String(providerId), override);
  }
}
