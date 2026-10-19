import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderEntity } from './entities/order.entity.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Order created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed on request body',
  })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<OrderEntity> {
    return this.ordersService.createOrder(createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve all orders' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all orders',
  })
  async getAllOrders(): Promise<OrderEntity[]> {
    return this.ordersService.getAllOrders();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve an order by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order not found',
  })
  async getOrderById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OrderEntity> {
    return this.ordersService.getOrderById(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Retrieve orders by User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of orders for specified user',
  })
  async getOrdersByUserId(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<OrderEntity[]> {
    return this.ordersService.getOrdersByUserId(userId);
  }
}
