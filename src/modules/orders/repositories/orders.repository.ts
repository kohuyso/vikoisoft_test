import { Injectable } from '@nestjs/common';
import { OrderEntity } from '../entities/order.entity.js';

@Injectable()
export class OrdersRepository {
  private readonly orders: Map<number, OrderEntity> = new Map();
  private autoIncrementId = 1;

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
    return { ...order };
  }

  async findById(id: number): Promise<OrderEntity | null> {
    const order = this.orders.get(id);
    return order ? { ...order } : null;
  }

  async findAll(): Promise<OrderEntity[]> {
    return Array.from(this.orders.values()).map((order) => ({ ...order }));
  }

  async findByUserId(userId: number): Promise<OrderEntity[]> {
    return Array.from(this.orders.values())
      .filter((order) => order.user_id === userId)
      .map((order) => ({ ...order }));
  }

  async clear(): Promise<void> {
    this.orders.clear();
    this.autoIncrementId = 1;
  }
}
