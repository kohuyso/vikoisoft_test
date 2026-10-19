import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { UserActivityResult } from '../entities/user-report.entity.js';

interface CacheEntry {
  activity_count: number;
  timestamp: number;
}

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(ExternalApiService.name);
  private readonly cache = new Map<number, CacheEntry>();
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds

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

    // 1. Check in-memory cache if not bypassed
    if (!bypassCache) {
      const cached = this.cache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        this.logger.debug(`Cache HIT for user ${userId}`);
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
        activity_count = response.data?.activity_count ?? 0;
      } else {
        // Direct simulation with random delay (2-5s) and timeout protection
        activity_count = await this.simulateExternalCallWithTimeout(
          userId,
          timeoutMs,
        );
      }

      // Store in cache
      this.cache.set(userId, {
        activity_count,
        timestamp: Date.now(),
      });

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

    const fetchPromise = new Promise<number>((resolve) => {
      setTimeout(() => {
        resolve(this.mockStats[userId] ?? 0);
      }, simulatedDelay);
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`External call timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([fetchPromise, timeoutPromise]);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
