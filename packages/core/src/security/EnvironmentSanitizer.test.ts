import { describe, it, expect } from 'vitest';
import { EnvironmentSanitizer } from './EnvironmentSanitizer.js';

describe('EnvironmentSanitizer', () => {
  it('should strip AWS keys, passwords, and tokens correctly', () => {
    const dirtyEnv = {
      PATH: '/usr/bin:/bin',
      NODE_ENV: 'production',
      AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
      AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      GITHUB_TOKEN: 'ghp_1234567890',
      GEMINI_API_KEY: 'AIzaSyExampleKey',
      my_secret_password: 'super_secret',
      USER_TOKEN: 'user-token-value',
      DB_AUTH_KEY: 'authkey',
    };

    const cleanEnv = EnvironmentSanitizer.sanitize(dirtyEnv);

    expect(cleanEnv.PATH).toBe('/usr/bin:/bin');
    expect(cleanEnv.NODE_ENV).toBe('production');

    expect(cleanEnv.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(cleanEnv.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(cleanEnv.GITHUB_TOKEN).toBeUndefined();
    expect(cleanEnv.GEMINI_API_KEY).toBeUndefined();
    expect(cleanEnv.my_secret_password).toBeUndefined();
    expect(cleanEnv.USER_TOKEN).toBeUndefined();
    expect(cleanEnv.DB_AUTH_KEY).toBeUndefined();
  });
});
