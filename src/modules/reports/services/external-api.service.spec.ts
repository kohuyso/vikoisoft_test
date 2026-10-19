import { describe, it, expect, beforeEach } from 'vitest';
import { ExternalApiService } from './external-api.service.js';

describe('ExternalApiService', () => {
  let service: ExternalApiService;

  beforeEach(() => {
    service = new ExternalApiService();
    service.clearCache();
  });

  it('should simulate external API fetch and cache result', async () => {
    // Call simulation with small timeout so it resolves or times out gracefully
    const result = await service.fetchUserStats(1, 6000, undefined, true);

    expect(result).toBeDefined();
    expect(result.activity_count).toBe(42);
    expect(result.source).toBe('external_api');

    // Second call should hit the cache immediately
    const cacheResult = await service.fetchUserStats(1, 6000, undefined, false);
    expect(cacheResult.source).toBe('cache');
    expect(cacheResult.activity_count).toBe(42);
    expect(cacheResult.latency_ms).toBeLessThan(10);
  }, 10000);

  it('should fall back gracefully to fallback_timeout when external call exceeds timeoutMs', async () => {
    // Give 1ms timeout, guaranteed to timeout against 2-5s simulation
    const result = await service.fetchUserStats(2, 1, undefined, true);

    expect(result.source).toBe('fallback_timeout');
    expect(result.activity_count).toBe(0);
  });
});
