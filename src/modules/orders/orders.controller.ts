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
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'List all stored orders' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all orders in mock database',
  })
  async getAllOrders(): Promise<OrderEntity[]> {
    return this.ordersService.getAllOrders();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order found and returned',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order with specified ID not found',
  })
  async getOrderById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OrderEntity> {
    return this.ordersService.getOrderById(id);
  }
}
