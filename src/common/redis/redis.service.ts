import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';

export interface RedisStatus {
  isConnected: boolean;
  mode: 'redis' | 'fallback_in_memory';
  host: string;
  port: number;
  pingLatencyMs?: number;
  keysCount: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  private readonly host = process.env.REDIS_HOST ?? '127.0.0.1';
  private readonly port = parseInt(process.env.REDIS_PORT ?? '6379', 10);
  private readonly password = process.env.REDIS_PASSWORD || undefined;

  // In-memory fallback stores (used when Redis is offline or not installed)
  private readonly memoryStore = new Map<
    string,
    { value: string; expiresAt?: number }
  >();
  private readonly memoryLists = new Map<string, string[]>();
  private readonly memoryCounters = new Map<string, number>();
  private readonly MAX_FALLBACK_CAPACITY = 10_000;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    try {
      this.client = new Redis({
        host: this.host,
        port: this.port,
        password: this.password,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          if (times > 2) {
            // After 2 failed retries, back off to 30s to avoid console noise
            return 30000;
          }
          return 1000;
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(
          `Successfully connected to Redis at ${this.host}:${this.port}`,
        );
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        if (wasConnected) {
          this.logger.warn(
            `Redis connection lost: ${err.message}. Seamlessly switched to in-memory fallback.`,
          );
        }
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err) {
      this.logger.warn(
        `Failed to initialize Redis client: ${(err as Error).message}. Operating in in-memory fallback mode.`,
      );
      this.client = null;
      this.isConnected = false;
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.connect();
      this.isConnected = true;
      this.logger.log(
        `Redis client initialized and active at ${this.host}:${this.port}`,
      );
    } catch (err) {
      this.isConnected = false;
      this.logger.warn(
        `Redis server unreachable at ${this.host}:${this.port} (${(err as Error).message}). Active mode: IN-MEMORY FALLBACK.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        this.client.disconnect(false);
      } catch {
        // ignore teardown errors
      }
    }
  }

  /**
   * Status and Health Check
   */
  async getStatus(): Promise<RedisStatus> {
    let pingLatencyMs: number | undefined;
    let keysCount = this.memoryStore.size;

    if (this.isConnected && this.client) {
      try {
        const start = Date.now();
        await this.client.ping();
        pingLatencyMs = Date.now() - start;
        const dbsize = await this.client.dbsize();
        keysCount = dbsize;
      } catch {
        this.isConnected = false;
      }
    }

    return {
      isConnected: this.isConnected,
      mode: this.isConnected ? 'redis' : 'fallback_in_memory',
      host: this.host,
      port: this.port,
      pingLatencyMs,
      keysCount,
    };
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Helper: Safely serialize values preserving types
   */
  private serialize(value: any): string | undefined {
    if (value === undefined) return undefined;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Helper: Safely deserialize values
   */
  private deserialize<T>(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  /**
   * Key-Value: GET
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!key) return null;

    if (this.isConnected && this.client) {
      try {
        const data = await this.client.get(key);
        if (data === null) return null;
        return this.deserialize<T>(data);
      } catch (err) {
        this.logger.warn(
          `Redis GET failed for "${key}", using in-memory: ${(err as Error).message}`,
        );
      }
    }

    // In-memory fallback
    const entry = this.memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return this.deserialize<T>(entry.value);
  }

  /**
   * Key-Value: SET with optional TTL in seconds
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!key || value === undefined) return;

    const serialized = this.serialize(value);
    if (serialized === undefined) return;

    const validTtl =
      typeof ttlSeconds === 'number' &&
      Number.isFinite(ttlSeconds) &&
      ttlSeconds > 0
        ? Math.floor(ttlSeconds)
        : undefined;

    if (this.isConnected && this.client) {
      try {
        if (validTtl) {
          await this.client.set(key, serialized, 'EX', validTtl);
        } else {
          await this.client.set(key, serialized);
        }
        return;
      } catch (err) {
        this.logger.warn(
          `Redis SET failed for "${key}", using in-memory: ${(err as Error).message}`,
        );
      }
    }

    // In-memory fallback: Bound capacity to avoid memory leak
    if (this.memoryStore.size >= this.MAX_FALLBACK_CAPACITY) {
      this.evictExpiredOrOldest();
    }

    this.memoryStore.set(key, {
      value: serialized,
      expiresAt: validTtl ? Date.now() + validTtl * 1000 : undefined,
    });
  }

  private evictExpiredOrOldest(): void {
    const now = Date.now();
    for (const [k, v] of this.memoryStore.entries()) {
      if (v.expiresAt && now > v.expiresAt) {
        this.memoryStore.delete(k);
      }
    }
    if (this.memoryStore.size >= this.MAX_FALLBACK_CAPACITY) {
      const oldestKey = this.memoryStore.keys().next().value;
      if (oldestKey !== undefined) this.memoryStore.delete(oldestKey);
    }
  }

  /**
   * Key-Value: DEL
   */
  async del(key: string): Promise<void> {
    if (!key) return;

    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch (err) {
        this.logger.warn(
          `Redis DEL failed for "${key}": ${(err as Error).message}`,
        );
      }
    }
    this.memoryStore.delete(key);
    this.memoryLists.delete(key);
    this.memoryCounters.delete(key);
  }

  /**
   * Delete keys by pattern (e.g., 'reports:*') with chunked execution
   */
  async delPattern(pattern: string): Promise<void> {
    if (!pattern) return;

    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        // Chunk deletion in batches of 500 to prevent stack overflow
        for (let i = 0; i < keys.length; i += 500) {
          const chunk = keys.slice(i, i + 500);
          await this.client.del(...chunk);
        }
      } catch (err) {
        this.logger.warn(
          `Redis delPattern failed for "${pattern}": ${(err as Error).message}`,
        );
      }
    }

    // In-memory fallback: Convert simple wildcard pattern to regex
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of Array.from(this.memoryStore.keys())) {
      if (regexPattern.test(key)) this.memoryStore.delete(key);
    }
    for (const key of Array.from(this.memoryLists.keys())) {
      if (regexPattern.test(key)) this.memoryLists.delete(key);
    }
    for (const key of Array.from(this.memoryCounters.keys())) {
      if (regexPattern.test(key)) this.memoryCounters.delete(key);
    }
  }

  /**
   * Key-Value: EXISTS
   */
  async exists(key: string): Promise<boolean> {
    if (!key) return false;

    if (this.isConnected && this.client) {
      try {
        const count = await this.client.exists(key);
        return count > 0;
      } catch {
        // fallback
      }
    }
    const entry = this.memoryStore.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return false;
    }
    return true;
  }

  /**
   * List / Queue: LPUSH
   */
  async lpush(key: string, value: any): Promise<number> {
    if (!key || value === undefined) return 0;

    const serialized = this.serialize(value);
    if (serialized === undefined) return 0;

    if (this.isConnected && this.client) {
      try {
        return await this.client.lpush(key, serialized);
      } catch (err) {
        this.logger.warn(
          `Redis LPUSH failed for "${key}", using in-memory: ${(err as Error).message}`,
        );
      }
    }

    let list = this.memoryLists.get(key);
    if (!list) {
      list = [];
      this.memoryLists.set(key, list);
    }
    list.unshift(serialized);
    return list.length;
  }

  /**
   * List / Queue: RPOP
   */
  async rpop<T = any>(key: string): Promise<T | null> {
    if (!key) return null;

    if (this.isConnected && this.client) {
      try {
        const item = await this.client.rpop(key);
        if (item === null) return null;
        return this.deserialize<T>(item);
      } catch (err) {
        this.logger.warn(
          `Redis RPOP failed for "${key}", using in-memory: ${(err as Error).message}`,
        );
      }
    }

    const list = this.memoryLists.get(key);
    if (!list || list.length === 0) return null;
    const item = list.pop();
    if (!item) return null;
    return this.deserialize<T>(item);
  }

  /**
   * List / Queue: LLEN
   */
  async llen(key: string): Promise<number> {
    if (!key) return 0;

    if (this.isConnected && this.client) {
      try {
        return await this.client.llen(key);
      } catch {
        // fallback
      }
    }
    return this.memoryLists.get(key)?.length ?? 0;
  }

  /**
   * List / Queue: LRANGE
   */
  async lrange<T = any>(key: string, start = 0, stop = -1): Promise<T[]> {
    if (!key) return [];

    if (this.isConnected && this.client) {
      try {
        const rawItems = await this.client.lrange(key, start, stop);
        return rawItems.map((item) => this.deserialize<T>(item));
      } catch {
        // fallback
      }
    }

    const list = this.memoryLists.get(key) ?? [];
    const end = stop === -1 ? undefined : stop + 1;
    const sliced = list.slice(start, end);
    return sliced.map((item) => this.deserialize<T>(item));
  }

  /**
   * Counter: INCR
   */
  async incr(key: string): Promise<number> {
    if (!key) return 0;

    if (this.isConnected && this.client) {
      try {
        return await this.client.incr(key);
      } catch {
        // fallback
      }
    }
    const current = (this.memoryCounters.get(key) ?? 0) + 1;
    this.memoryCounters.set(key, current);
    return current;
  }

  /**
   * Counter: DECR
   */
  async decr(key: string): Promise<number> {
    if (!key) return 0;

    if (this.isConnected && this.client) {
      try {
        return await this.client.decr(key);
      } catch {
        // fallback
      }
    }
    const current = (this.memoryCounters.get(key) ?? 0) - 1;
    this.memoryCounters.set(key, current);
    return current;
  }

  /**
   * Counter: GET COUNTER
   */
  async getCounter(key: string): Promise<number> {
    if (!key) return 0;

    if (this.isConnected && this.client) {
      try {
        const val = await this.client.get(key);
        return val ? parseInt(val, 10) : 0;
      } catch {
        // fallback
      }
    }
    return this.memoryCounters.get(key) ?? 0;
  }

  /**
   * Clears all stores (used in test tear-downs)
   */
  async flushall(): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.flushdb();
      } catch {
        // fallback
      }
    }
    this.memoryStore.clear();
    this.memoryLists.clear();
    this.memoryCounters.clear();
  }
}
