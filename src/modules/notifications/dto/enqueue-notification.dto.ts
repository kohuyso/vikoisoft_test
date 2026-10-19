import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class EnqueueNotificationDto {
  @ApiProperty({ example: 1001, description: 'Order ID' })
  @IsInt({ message: 'orderId must be an integer' })
  @IsPositive({ message: 'orderId must be positive' })
  orderId!: number;

  @ApiProperty({
    example: 'customer@example.com',
    description: 'Recipient email address',
  })
  @IsEmail({}, { message: 'recipientEmail must be a valid email' })
  @IsNotEmpty({ message: 'recipientEmail is required' })
  recipientEmail!: string;

  @ApiProperty({ example: 'CONFIRMED', description: 'Order status update' })
  @IsString({ message: 'orderStatus must be a string' })
  @IsNotEmpty({ message: 'orderStatus cannot be empty' })
  orderStatus!: string;

  @ApiPropertyOptional({
    example: { customerName: 'John Doe', amount: 99.99 },
    description: 'Dynamic template metadata',
  })
  @IsOptional()
  templateData?: Record<string, unknown>;
}

export class BatchBenchmarkDto {
  @ApiProperty({
    example: 100,
    description: 'Number of notifications to enqueue concurrently',
  })
  @IsInt({ message: 'count must be an integer' })
  @IsPositive({ message: 'count must be positive' })
  count!: number;
}
