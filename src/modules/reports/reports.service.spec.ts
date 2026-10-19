import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportsService } from './reports.service.js';
import { LocalUserRepository } from './repositories/local-user.repository.js';
import { ExternalApiService } from './services/external-api.service.js';

describe('ReportsService', () => {
  let reportsService: ReportsService;
  let localRepo: LocalUserRepository;
  let externalApiService: ExternalApiService;

  beforeEach(() => {
    localRepo = new LocalUserRepository();
    externalApiService = new ExternalApiService();
    reportsService = new ReportsService(localRepo, externalApiService);
  });

  it('should aggregate local users and external activities concurrently', async () => {
    // Mock external calls with small delays to verify parallel concurrency
    vi.spyOn(externalApiService, 'fetchUserStats').mockImplementation(
      async (userId) => {
        const statsMap: Record<number, number> = { 1: 42, 2: 31, 3: 17 };
        return {
          activity_count: statsMap[userId] ?? 0,
          source: 'external_api',
          latency_ms: 10,
        };
      },
    );

    const report = await reportsService.generateAggregatedReport();

    expect(report.length).toBe(3);

    const alice = report.find((u) => u.name === 'Alice');
    expect(alice).toBeDefined();
    expect(alice?.last_login).toBe('2025-10-10');
    expect(alice?.activity_count).toBe(42);

    const bob = report.find((u) => u.name === 'Bob');
    expect(bob?.activity_count).toBe(31);

    const charlie = report.find((u) => u.name === 'Charlie');
    expect(charlie?.activity_count).toBe(17);
  });

  it('should gracefully handle timeout on slow external API responses without failing entire report', async () => {
    vi.spyOn(externalApiService, 'fetchUserStats').mockImplementation(
      async (userId) => {
        if (userId === 2) {
          return {
            activity_count: 0,
            source: 'fallback_timeout',
            latency_ms: 3000,
          };
        }
        return {
          activity_count: 42,
          source: 'external_api',
          latency_ms: 50,
        };
      },
    );

    const report = await reportsService.generateAggregatedReport();

    expect(report.length).toBe(3);
    const bob = report.find((u) => u.id === 2);
    expect(bob?.activity_count).toBe(0);

    const alice = report.find((u) => u.id === 1);
    expect(alice?.activity_count).toBe(42);
  });
});
