---
name: nestjs-clean-architecture
description: Expert NestJS architect and clean code specialist. Provides best practices for modular architecture, DTO validation, global interceptors, exception filters, in-memory repositories, async queues, and Vitest testing.
---

# NestJS Clean Architecture Skill

This skill guides development of scalable, maintainable, and robust NestJS applications with clean architecture and SOLID principles.

## 1. Modular Directory Structure
Organize features by domain module rather than technical layer:

```text
src/
├── common/
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── transform.interceptor.ts
│   └── interfaces/
│       └── api-response.interface.ts
├── modules/
│   ├── orders/
│   │   ├── dto/
│   │   │   ├── create-order.dto.ts
│   │   │   └── order-response.dto.ts
│   │   ├── entities/
│   │   │   └── order.entity.ts
│   │   ├── repositories/
│   │   │   └── orders.repository.ts
│   │   ├── orders.controller.ts
│   │   ├── orders.service.ts
│   │   └── orders.module.ts
│   ├── reports/
│   └── notifications/
├── app.module.ts
└── main.ts
```

---

## 2. DTO & Validation Pattern
Always validate incoming request data using `class-validator` and `class-transformer`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ example: 101, description: 'Product identifier' })
  @IsInt()
  @IsPositive()
  productId!: number;

  @ApiProperty({ example: 2, description: 'Quantity of items ordered' })
  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 1, description: 'ID of the ordering user' })
  @IsInt()
  @IsPositive()
  userId!: number;

  @ApiProperty({ type: [OrderItemDto], description: 'List of order items' })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({ example: 'Please deliver before 5 PM', description: 'Special delivery note' })
  @IsOptional()
  @IsString()
  note?: string;
}
```

---

## 3. Standardized Response Interceptor & Exception Filter

### Transform Interceptor (`src/common/interceptors/transform.interceptor.ts`)
```typescript
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<T>> {
    const statusCode = context.switchToHttp().getResponse().statusCode;
    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### Global HTTP Exception Filter (`src/common/filters/http-exception.filter.ts`)
```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const errorObj = res as Record<string, any>;
        message = errorObj.message ?? message;
        error = errorObj.error ?? error;
      }
    } else {
      this.logger.error('Unhandled exception occurred', exception);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

---

## 4. In-Memory Store / Mock Database Pattern
Create a clean, isolated repository layer rather than storing raw arrays inside the service:

```typescript
import { Injectable } from '@nestjs/common';
import { OrderEntity } from '../entities/order.entity.js';

@Injectable()
export class OrdersRepository {
  private readonly orders: Map<number, OrderEntity> = new Map();
  private currentId = 1;

  async create(orderData: Omit<OrderEntity, 'id' | 'createdAt'>): Promise<OrderEntity> {
    const id = this.currentId++;
    const order: OrderEntity = {
      id,
      ...orderData,
      createdAt: new Date(),
    };
    this.orders.set(id, order);
    return order;
  }

  async findById(id: number): Promise<OrderEntity | null> {
    return this.orders.get(id) ?? null;
  }

  async findAll(): Promise<OrderEntity[]> {
    return Array.from(this.orders.values());
  }

  async clear(): Promise<void> {
    this.orders.clear();
    this.currentId = 1;
  }
}
```

---

## 5. Resilience, Concurrency & Retry Patterns

### External API Aggregation with Timeout
```typescript
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class ExternalAggregatorService {
  private readonly logger = new Logger(ExternalAggregatorService.name);

  async fetchWithTimeout<T>(url: string, timeoutMs = 3000): Promise<T | null> {
    try {
      const response = await axios.get<T>(url, { timeout: timeoutMs });
      return response.data;
    } catch (error) {
      this.logger.warn(`Failed or timed out fetching ${url}: ${(error as Error).message}`);
      return null;
    }
  }

  async aggregateData(urls: string[]): Promise<any[]> {
    const results = await Promise.allSettled(
      urls.map((url) => this.fetchWithTimeout(url)),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value);
  }
}
```

### High-Throughput Async Queue Worker with Retry
```typescript
export interface QueueJob<T> {
  id: string;
  data: T;
  retriesLeft: number;
  backoffMs: number;
}

export class AsyncQueueWorker<T> {
  private queue: QueueJob<T>[] = [];
  private activeWorkers = 0;
  private readonly maxConcurrency: number;

  constructor(maxConcurrency = 50) {
    this.maxConcurrency = maxConcurrency;
  }

  enqueue(jobData: T, maxRetries = 3, initialBackoffMs = 100): void {
    this.queue.push({
      id: crypto.randomUUID(),
      data: jobData,
      retriesLeft: maxRetries,
      backoffMs: initialBackoffMs,
    });
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.activeWorkers >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeWorkers++;
    try {
      await this.executeJob(job.data);
    } catch (err) {
      if (job.retriesLeft > 0) {
        job.retriesLeft--;
        job.backoffMs *= 2; // Exponential backoff
        setTimeout(() => {
          this.queue.push(job);
          this.processNext();
        }, job.backoffMs);
      }
    } finally {
      this.activeWorkers--;
      this.processNext();
    }
  }

  protected async executeJob(data: T): Promise<void> {
    // Custom job execution
  }
}
```
