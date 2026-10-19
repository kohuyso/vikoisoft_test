import { Injectable, Logger } from '@nestjs/common';
import {
  AggregatedReportResponse,
  MergedUserReportItem,
} from './entities/user-report.entity.js';
import { LocalUserRepository } from './repositories/local-user.repository.js';
import { ExternalApiService } from './services/external-api.service.js';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly localUserRepository: LocalUserRepository,
    private readonly externalApiService: ExternalApiService,
  ) {}

  /**
   * Aggregates user profile data with external stats concurrently.
   *
   * By using Promise.all to fetch external stats concurrently for all users,
   * total execution time is bounded by max(delay_i) instead of sum(delay_i).
   *
   * Example: 3 users with delays [3s, 4.5s, 2s]:
   * - Sequential execution: 3s + 4.5s + 2s = 9.5s
   * - Parallel execution (Promise.all): max(3s, 4.5s, 2s) ≈ 4.5s (over 50% faster!)
   * - With caching: < 5ms on subsequent requests.
   */
  async generateAggregatedReport(options?: {
    timeoutMs?: number;
    bypassCache?: boolean;
    baseUrl?: string;
  }): Promise<AggregatedReportResponse> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs ?? 4500;
    const bypassCache = options?.bypassCache ?? false;

    // 1. Fetch local users (simulated DB read)
    const localUsers = await this.localUserRepository.findAllUsers();

    // 2. Concurrently fetch external stats using Promise.all
    const userPromises = localUsers.map(
      async (user): Promise<MergedUserReportItem> => {
        const stats = await this.externalApiService.fetchUserStats(
          user.id,
          timeoutMs,
          options?.baseUrl,
          bypassCache,
        );

        let status: 'SUCCESS' | 'TIMEOUT' | 'ERROR' = 'SUCCESS';
        if (stats.source === 'fallback_timeout') {
          status = 'TIMEOUT';
        } else if (stats.source === 'fallback_error') {
          status = 'ERROR';
        }

        return {
          id: user.id,
          name: user.name,
          last_login: user.last_login,
          activity_count: stats.activity_count,
          status,
          data_source: stats.source,
          latency_ms: stats.latency_ms,
        };
      },
    );

    const mergedUsers = await Promise.all(userPromises);
    const totalExecutionTime = Date.now() - startTime;
    const totalActivities = mergedUsers.reduce(
      (sum, u) => sum + u.activity_count,
      0,
    );

    this.logger.log(
      `Aggregated report for ${mergedUsers.length} users completed in ${totalExecutionTime}ms (Parallel Promise.all)`,
    );

    return {
      summary: {
        total_users: mergedUsers.length,
        total_activities: totalActivities,
        total_execution_time_ms: totalExecutionTime,
        strategy: 'Parallel Promise.all with timeout guard & in-memory caching',
        concurrency_optimization:
          'Concurrent requests run simultaneously, bounding latency to max(delays) instead of sum(delays)',
      },
      users: mergedUsers,
    };
  }
}
