import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderEntity } from './entities/order.entity.js';
import { OrdersRepository } from './repositories/orders.repository.js';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly ordersRepository: OrdersRepository) {}

  async createOrder(dto: CreateOrderDto): Promise<OrderEntity> {
    const total_items = dto.items.reduce((sum, item) => sum + item.quantity, 0);

    const newOrder = await this.ordersRepository.create({
      user_id: dto.user_id,
      items: dto.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
      note: dto.note?.trim() || undefined,
      total_items,
      status: 'PENDING',
    });

    this.logger.log(
      `Order #${newOrder.id} successfully created for user ${newOrder.user_id}`,
    );
    return newOrder;
  }

  async getAllOrders(): Promise<OrderEntity[]> {
    return this.ordersRepository.findAll();
  }

  async getOrderById(id: number): Promise<OrderEntity> {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async getOrdersByUserId(userId: number): Promise<OrderEntity[]> {
    return this.ordersRepository.findByUserId(userId);
  }
}
