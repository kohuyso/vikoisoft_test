import { Injectable, Optional } from '@nestjs/common';
import { OrderEntity } from '../entities/order.entity.js';
import { RedisService } from '../../../common/redis/redis.service.js';

@Injectable()
export class OrdersRepository {
  private readonly orders: Map<number, OrderEntity> = new Map();
  private autoIncrementId = 1;

  constructor(@Optional() private readonly redisService?: RedisService) {}

  async create(
    orderData: Omit<OrderEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<OrderEntity> {
    const id = this.autoIncrementId++;
    const now = new Date().toISOString();
    const order: OrderEntity = {
      id,
      ...orderData,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(id, order);

    // Redis Cache: store individual order and invalidate user order list cache
    if (this.redisService) {
      await this.redisService.set(`orders:${id}`, order, 3600);
      await this.redisService.del(`orders:user:${order.user_id}`);
    }

    return { ...order };
  }

  async findById(id: number): Promise<OrderEntity | null> {
    // 1. Try Redis cache
    if (this.redisService) {
      const cached = await this.redisService.get<OrderEntity>(`orders:${id}`);
      if (cached) return { ...cached };
    }

    // 2. Fallback to primary store
    const order = this.orders.get(id);
    if (!order) return null;

    // Cache back to Redis
    if (this.redisService) {
      await this.redisService.set(`orders:${id}`, order, 3600);
    }

    return { ...order };
  }

  async findAll(): Promise<OrderEntity[]> {
    return Array.from(this.orders.values()).map((order) => ({ ...order }));
  }

  async findByUserId(userId: number): Promise<OrderEntity[]> {
    // 1. Try Redis cache
    if (this.redisService) {
      const cached = await this.redisService.get<OrderEntity[]>(
        `orders:user:${userId}`,
      );
      if (cached) return cached;
    }

    // 2. Fetch from store
    const result = Array.from(this.orders.values())
      .filter((order) => order.user_id === userId)
      .map((order) => ({ ...order }));

    // Cache in Redis
    if (this.redisService) {
      await this.redisService.set(`orders:user:${userId}`, result, 3600);
    }

    return result;
  }

  async clear(): Promise<void> {
    this.orders.clear();
    this.autoIncrementId = 1;
    if (this.redisService) {
      await this.redisService.delPattern('orders:*');
    }
  }
}
