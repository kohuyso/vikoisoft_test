import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  BatchBenchmarkDto,
  EnqueueNotificationDto,
} from './dto/enqueue-notification.dto.js';
import { NotificationJob } from './entities/notification-job.entity.js';
import { NotificationLog } from './entities/notification-log.entity.js';
import { NotificationsService } from './notifications.service.js';
import { QueueMetrics } from './services/notification-queue.service.js';

@ApiTags('Notifications (Question 3)')
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('enqueue')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Enqueue order status update notification',
    description:
      'Pushes notification job into async queue and returns 202 Accepted immediately',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Notification job accepted into queue',
  })
  enqueue(@Body() dto: EnqueueNotificationDto): {
    message: string;
    jobId: string;
    status: string;
  } {
    return this.notificationsService.enqueueNotification(dto);
  }

  @Post('batch-benchmark')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Benchmark queue concurrency with a burst of jobs',
    description:
      'Demonstrates high-throughput processing capability (e.g., 10,000 notifications/min target)',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Burst of notification jobs enqueued',
  })
  batchBenchmark(@Body() dto: BatchBenchmarkDto): {
    enqueued: number;
    metrics: QueueMetrics;
    message: string;
  } {
    return this.notificationsService.simulateBatchBurst(dto.count);
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get real-time worker pool and queue metrics',
    description:
      'Inspect active workers, queue depth, success count, retry count, and DLQ',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Queue metrics returned',
  })
  getMetrics(): QueueMetrics {
    return this.notificationsService.getMetrics();
  }

  @Get('logs')
  @ApiOperation({
    summary: 'Retrieve asynchronous audit logs',
    description: 'View non-blocking audit trail of dispatched notifications',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max logs to return (default 50)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of audit logs',
  })
  async getLogs(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<NotificationLog[]> {
    if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return this.notificationsService.getLogs(limit ?? 50);
  }

  @Get('dlq')
  @ApiOperation({
    summary: 'Inspect Dead Letter Queue (DLQ)',
    description:
      'View jobs that failed permanently after exhausting all retry attempts',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of dead-letter jobs',
  })
  getDLQ(): NotificationJob[] {
    return this.notificationsService.getDLQ();
  }
}
