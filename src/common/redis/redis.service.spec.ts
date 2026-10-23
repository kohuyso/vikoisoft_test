import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RedisService } from './redis.service.js';

describe('RedisService', () => {
  let redisService: RedisService;

  beforeEach(() => {
    redisService = new RedisService();
  });

  afterEach(async () => {
    await redisService.flushall();
    await redisService.onModuleDestroy();
  });

  it('should initialize and provide status', async () => {
    const status = await redisService.getStatus();
    expect(status).toBeDefined();
    expect(['redis', 'fallback_in_memory']).toContain(status.mode);
    expect(status.host).toBeDefined();
    expect(status.port).toBeDefined();
  });

  it('should set and get values with TTL', async () => {
    await redisService.set('test:key', { message: 'hello' }, 10);
    const value = await redisService.get<{ message: string }>('test:key');
    expect(value).toEqual({ message: 'hello' });

    const exists = await redisService.exists('test:key');
    expect(exists).toBe(true);

    await redisService.del('test:key');
    const afterDel = await redisService.get('test:key');
    expect(afterDel).toBeNull();
  });

  it('should handle list queue operations (lpush, rpop, llen, lrange)', async () => {
    await redisService.lpush('test:queue', { id: 1 });
    await redisService.lpush('test:queue', { id: 2 });

    const len = await redisService.llen('test:queue');
    expect(len).toBe(2);

    const firstOut = await redisService.rpop<{ id: number }>('test:queue');
    expect(firstOut).toEqual({ id: 1 });

    const remaining = await redisService.lrange<{ id: number }>('test:queue');
    expect(remaining.length).toBe(1);
    expect(remaining[0]).toEqual({ id: 2 });
  });

  it('should handle atomic counters (incr, decr, getCounter)', async () => {
    const count1 = await redisService.incr('test:counter');
    expect(count1).toBe(1);

    const count2 = await redisService.incr('test:counter');
    expect(count2).toBe(2);

    const count3 = await redisService.decr('test:counter');
    expect(count3).toBe(1);

    const current = await redisService.getCounter('test:counter');
    expect(current).toBe(1);
  });

  it('should delete keys matching wildcard pattern', async () => {
    await redisService.set('prefix:1', 'val1');
    await redisService.set('prefix:2', 'val2');
    await redisService.set('other:3', 'val3');

    await redisService.delPattern('prefix:*');

    expect(await redisService.get('prefix:1')).toBeNull();
    expect(await redisService.get('prefix:2')).toBeNull();
    expect(await redisService.get('other:3')).toBe('val3');
  });
});
