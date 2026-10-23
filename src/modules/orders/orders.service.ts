import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderEntity } from './entities/order.entity.js';
import { OrdersRepository } from './repositories/orders.repository.js';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly ordersRepository: OrdersRepository) {}

  async createOrder(dto: CreateOrderDto): Promise<OrderEntity> {
    if (!dto) {
      throw new BadRequestException('Request body cannot be empty');
    }
    if (!dto.user_id || typeof dto.user_id !== 'number' || dto.user_id <= 0) {
      throw new BadRequestException('user_id must be a positive integer');
    }
    if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }

    // Consolidate duplicate items by product_id if present
    const consolidatedMap = new Map<number, number>();
    for (const item of dto.items) {
      consolidatedMap.set(
        item.product_id,
        (consolidatedMap.get(item.product_id) ?? 0) + item.quantity,
      );
    }
    const consolidatedItems = Array.from(consolidatedMap.entries()).map(
      ([product_id, quantity]) => ({ product_id, quantity }),
    );

    const total_items = consolidatedItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const newOrder = await this.ordersRepository.create({
      user_id: dto.user_id,
      items: consolidatedItems,
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
    if (!id || typeof id !== 'number' || id <= 0) {
      throw new BadRequestException('Order ID must be a positive integer');
    }
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
