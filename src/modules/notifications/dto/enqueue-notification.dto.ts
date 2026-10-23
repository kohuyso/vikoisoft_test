import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
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
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'recipientEmail must be a valid email' })
  @IsNotEmpty({ message: 'recipientEmail is required' })
  @MaxLength(255, { message: 'recipientEmail cannot exceed 255 characters' })
  recipientEmail!: string;

  @ApiProperty({ example: 'CONFIRMED', description: 'Order status update' })
  @IsString({ message: 'orderStatus must be a string' })
  @IsNotEmpty({ message: 'orderStatus cannot be empty' })
  @MaxLength(50, { message: 'orderStatus cannot exceed 50 characters' })
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
  @Max(5000, { message: 'count cannot exceed 5000 per benchmark run' })
  count!: number;
}
