import { Injectable, Logger } from '@nestjs/common';
import { MergedUserReportItem } from './entities/user-report.entity.js';
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
   * Aggregates user profile data with external activity count concurrently.
   *
   * By using Promise.all to fetch external stats concurrently for all users,
   * total execution time is bounded by max(delay_i) instead of sum(delay_i).
   */
  async generateAggregatedReport(options?: {
    timeoutMs?: number;
    bypassCache?: boolean;
    baseUrl?: string;
  }): Promise<MergedUserReportItem[]> {
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

        return {
          id: user.id,
          name: user.name,
          last_login: user.last_login,
          activity_count: stats.activity_count,
        };
      },
    );

    const mergedUsers = await Promise.all(userPromises);
    const durationMs = Date.now() - startTime;

    this.logger.log(
      `Aggregated report for ${mergedUsers.length} users completed in ${durationMs}ms (Parallel Promise.all)`,
    );

    return mergedUsers;
  }
}
