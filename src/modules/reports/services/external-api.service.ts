import { Injectable, Logger, Optional } from '@nestjs/common';
import axios from 'axios';
import { UserActivityResult } from '../entities/user-report.entity.js';
import { RedisService } from '../../../common/redis/redis.service.js';

interface CacheEntry {
  activity_count: number;
  timestamp: number;
}

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(ExternalApiService.name);
  private readonly cache = new Map<number, CacheEntry>();
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds
  private readonly CACHE_TTL_SEC = 60;

  constructor(@Optional() private readonly redisService?: RedisService) {}

  // Static stats definition matching mock requirements
  private readonly mockStats: Record<number, number> = {
    1: 42,
    2: 31,
    3: 17,
  };

  /**
   * Fetches user stats with concurrency handling, timeout guard, and fallback.
   *
   * @param userId user identifier
   * @param timeoutMs max wait time before timeout fallback
   * @param baseUrl optional base URL of the running server
   * @param bypassCache if true, force re-fetching from external API
   */
  async fetchUserStats(
    userId: number,
    timeoutMs = 4500,
    baseUrl?: string,
    bypassCache = false,
  ): Promise<UserActivityResult> {
    const startTime = Date.now();

    // 1. Check Redis cache and in-memory cache if not bypassed
    if (!bypassCache) {
      if (this.redisService) {
        try {
          const redisCached = await this.redisService.get<number>(
            `reports:user_stats:${userId}`,
          );
          if (redisCached !== null && redisCached !== undefined) {
            this.logger.debug(`Cache HIT for user ${userId} (Redis)`);
            return {
              activity_count: redisCached,
              source: 'cache',
              latency_ms: Date.now() - startTime,
            };
          }
        } catch (err) {
          this.logger.warn(
            `Redis cache read failed for user ${userId}: ${(err as Error).message}`,
          );
        }
      }

      const cached = this.cache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        this.logger.debug(`Cache HIT for user ${userId} (In-Memory)`);
        return {
          activity_count: cached.activity_count,
          source: 'cache',
          latency_ms: Date.now() - startTime,
        };
      }
    }

    // 2. Fetch from external endpoint or simulated provider
    try {
      let activity_count = 0;

      if (baseUrl) {
        // Real HTTP call to external endpoint with strict timeout
        const url = `${baseUrl}/mock/external/${userId}`;
        const response = await axios.get<{ activity_count: number }>(url, {
          timeout: timeoutMs,
        });
        const body = response.data as Record<string, unknown> | undefined;
        const nestedData = body?.data as Record<string, unknown> | undefined;
        const rawCount =
          typeof nestedData?.activity_count === 'number'
            ? nestedData.activity_count
            : body?.activity_count;
        activity_count =
          typeof rawCount === 'number' &&
          Number.isFinite(rawCount) &&
          rawCount >= 0
            ? rawCount
            : 0;
      } else {
        // Direct simulation with random delay (2-5s) and timeout protection
        activity_count = await this.simulateExternalCallWithTimeout(
          userId,
          timeoutMs,
        );
      }

      // Bound in-memory cache to prevent memory leak
      if (this.cache.size >= 5000) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey !== undefined) this.cache.delete(oldestKey);
      }

      // Store in L1 in-memory cache
      this.cache.set(userId, {
        activity_count,
        timestamp: Date.now(),
      });

      // Store in L2 Redis cache with TTL
      if (this.redisService) {
        try {
          await this.redisService.set(
            `reports:user_stats:${userId}`,
            activity_count,
            this.CACHE_TTL_SEC,
          );
        } catch (err) {
          this.logger.warn(
            `Redis cache write failed for user ${userId}: ${(err as Error).message}`,
          );
        }
      }

      return {
        activity_count,
        source: 'external_api',
        latency_ms: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const isTimeout =
        (axios.isAxiosError(err) &&
          (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT')) ||
        (err instanceof Error && err.message.includes('timeout'));

      this.logger.warn(
        `External API call for user ${userId} ${isTimeout ? 'TIMED OUT' : 'FAILED'}: ${(err as Error).message}`,
      );

      return {
        activity_count: 0,
        source: isTimeout ? 'fallback_timeout' : 'fallback_error',
        latency_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Helper to simulate the external call with Promise.race against a timeout
   */
  private async simulateExternalCallWithTimeout(
    userId: number,
    timeoutMs: number,
  ): Promise<number> {
    const simulatedDelay = Math.floor(Math.random() * 3000) + 2000; // 2–5s delay
    let fetchTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;

    try {
      const fetchPromise = new Promise<number>((resolve) => {
        fetchTimer = setTimeout(() => {
          resolve(this.mockStats[userId] ?? 0);
        }, simulatedDelay);
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(() => {
          reject(new Error(`External call timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      return await Promise.race([fetchPromise, timeoutPromise]);
    } finally {
      if (fetchTimer) clearTimeout(fetchTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    if (this.redisService) {
      await this.redisService.delPattern('reports:user_stats:*');
    }
  }
}
