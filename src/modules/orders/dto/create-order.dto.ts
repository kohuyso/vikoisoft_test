import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ example: 101, description: 'Product identifier' })
  @IsInt({ message: 'product_id must be an integer' })
  @IsPositive({ message: 'product_id must be a positive integer (> 0)' })
  product_id!: number;

  @ApiProperty({ example: 2, description: 'Quantity of items ordered' })
  @IsInt({ message: 'quantity must be an integer' })
  @IsPositive({ message: 'quantity must be a positive integer (> 0)' })
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 1, description: 'User identifier placing the order' })
  @IsInt({ message: 'user_id must be an integer' })
  @IsPositive({ message: 'user_id must be a positive integer (> 0)' })
  user_id!: number;

  @ApiProperty({
    type: [OrderItemDto],
    description: 'Array of items to purchase with product_id and quantity',
    example: [
      { product_id: 101, quantity: 2 },
      { product_id: 202, quantity: 1 },
    ],
  })
  @IsArray({ message: 'items must be an array' })
  @ArrayNotEmpty({ message: 'items array cannot be empty' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({
    example: 'Deliver during office hours (9am - 5pm)',
    description: 'Optional note from customer',
  })
  @IsOptional()
  @IsString({ message: 'note must be a string' })
  @MaxLength(500, { message: 'note cannot exceed 500 characters' })
  note?: string;
}
