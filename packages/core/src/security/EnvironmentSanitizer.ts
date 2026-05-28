/**
 * MetaCLI Core — Environment Sanitizer
 *
 * Prevents side-channel leaks / credential exfiltration from spawned subprocesses.
 * Automatically strips sensitive keys like AWS keys, private tokens, keychains, and passwords
 * from target env blocks before subprocess adapters invoke native CLI runtimes.
 */

export class EnvironmentSanitizer {
  private static sensitiveSubstrings = [
    'aws',
    'github_token',
    'api_key',
    'secret',
    'password',
    'keychain',
    'token',
    'auth',
    'private',
  ];

  /**
   * Filter and sanitize a set of environment variables.
   * Returns a copy with sensitive variables replaced or stripped.
   */
  static sanitize(env: Record<string, string | undefined>): Record<string, string> {
    const clean: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) continue;

      const lowerKey = key.toLowerCase();

      // Check if key contains any sensitive keyword
      const isSensitive = this.sensitiveSubstrings.some((substring) =>
        lowerKey.includes(substring),
      );

      // Keep orchestrator essentials, but sanitize any credentials
      if (isSensitive) {
        // Redact or drop
        continue;
      }

      clean[key] = value;
    }

    return clean;
  }
}
