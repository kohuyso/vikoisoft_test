import { describe, it, expect, beforeEach } from 'vitest';
import { OrdersService } from './orders.service.js';
import { OrdersRepository } from './repositories/orders.repository.js';
import { NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: OrdersRepository;

  beforeEach(() => {
    repository = new OrdersRepository();
    service = new OrdersService(repository);
  });

  it('should create an order successfully with valid items and note', async () => {
    const order = await service.createOrder({
      user_id: 1,
      items: [
        { product_id: 101, quantity: 2 },
        { product_id: 102, quantity: 3 },
      ],
      note: 'Fragile handling',
    });

    expect(order.id).toBe(1);
    expect(order.user_id).toBe(1);
    expect(order.items.length).toBe(2);
    expect(order.total_items).toBe(5);
    expect(order.note).toBe('Fragile handling');
    expect(order.status).toBe('PENDING');
    expect(order.createdAt).toBeDefined();
  });

  it('should create an order without optional note', async () => {
    const order = await service.createOrder({
      user_id: 2,
      items: [{ product_id: 201, quantity: 1 }],
    });

    expect(order.id).toBe(1);
    expect(order.user_id).toBe(2);
    expect(order.note).toBeUndefined();
    expect(order.total_items).toBe(1);
  });

  it('should retrieve an order by ID', async () => {
    const created = await service.createOrder({
      user_id: 1,
      items: [{ product_id: 101, quantity: 2 }],
    });

    const retrieved = await service.getOrderById(created.id);
    expect(retrieved).toEqual(created);
  });

  it('should throw NotFoundException when order does not exist', async () => {
    await expect(service.getOrderById(999)).rejects.toThrow(NotFoundException);
  });

  it('should retrieve orders by user ID', async () => {
    await service.createOrder({
      user_id: 10,
      items: [{ product_id: 101, quantity: 1 }],
    });
    await service.createOrder({
      user_id: 20,
      items: [{ product_id: 102, quantity: 2 }],
    });
    await service.createOrder({
      user_id: 10,
      items: [{ product_id: 103, quantity: 3 }],
    });

    const user10Orders = await service.getOrdersByUserId(10);
    expect(user10Orders.length).toBe(2);
    expect(user10Orders.every((o) => o.user_id === 10)).toBe(true);
  });
});
