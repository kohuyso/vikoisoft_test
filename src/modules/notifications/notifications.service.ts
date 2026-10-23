import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EnqueueNotificationDto } from './dto/enqueue-notification.dto.js';
import { NotificationJob } from './entities/notification-job.entity.js';
import { NotificationLog } from './entities/notification-log.entity.js';
import { NotificationLogRepository } from './repositories/notification-log.repository.js';
import {
  NotificationQueueService,
  QueueMetrics,
} from './services/notification-queue.service.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly queueService: NotificationQueueService,
    private readonly logRepository: NotificationLogRepository,
  ) {}

  enqueueNotification(dto: EnqueueNotificationDto): {
    message: string;
    jobId: string;
    status: string;
  } {
    if (!dto) {
      throw new BadRequestException(
        'Notification request body cannot be empty',
      );
    }
    if (!dto.orderId || typeof dto.orderId !== 'number' || dto.orderId <= 0) {
      throw new BadRequestException('orderId must be a positive integer');
    }
    if (!dto.recipientEmail || typeof dto.recipientEmail !== 'string') {
      throw new BadRequestException(
        'recipientEmail must be a valid email string',
      );
    }
    if (!dto.orderStatus || typeof dto.orderStatus !== 'string') {
      throw new BadRequestException('orderStatus must be a non-empty string');
    }

    const job = this.queueService.enqueue(
      dto.orderId,
      dto.recipientEmail,
      dto.orderStatus,
      dto.templateData,
    );

    return {
      message: 'Notification enqueued successfully for asynchronous delivery',
      jobId: job.id,
      status: job.status,
    };
  }

  /**
   * High-concurrency benchmark simulation:
   * Enqueues N notifications in a burst to demonstrate 10k/min queue performance.
   */
  simulateBatchBurst(count = 100): {
    enqueued: number;
    metrics: QueueMetrics;
    message: string;
  } {
    if (!count || typeof count !== 'number' || count <= 0) {
      throw new BadRequestException('count must be a positive integer');
    }
    if (count > 5000) {
      throw new BadRequestException(
        'count cannot exceed 5000 per benchmark run',
      );
    }

    for (let i = 1; i <= count; i++) {
      const orderId = 2000 + i;
      // Inject some flaky and failed emails to demonstrate retry & DLQ handling
      let email = `user${i}@example.com`;
      if (i % 25 === 0) {
        email = `flaky_user${i}@example.com`; // Retries once then succeeds
      } else if (i % 50 === 0) {
        email = `fail_user${i}@example.com`; // Exhausts retries -> DLQ
      }

      this.queueService.enqueue(orderId, email, 'SHIPPED', {
        trackingNumber: `VNPOST_${i}`,
      });
    }

    return {
      enqueued: count,
      metrics: this.queueService.getMetrics(),
      message: `Enqueued ${count} jobs into high-concurrency worker pool`,
    };
  }

  getMetrics(): QueueMetrics {
    return this.queueService.getMetrics();
  }

  getDLQ(): NotificationJob[] {
    return this.queueService.getDLQ();
  }

  async getLogs(limit = 50): Promise<NotificationLog[]> {
    const safeLimit =
      typeof limit === 'number' && !isNaN(limit) && limit > 0
        ? Math.min(limit, 1000)
        : 50;
    return this.logRepository.getRecentLogs(safeLimit);
  }
}
