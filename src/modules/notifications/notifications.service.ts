import { Injectable, Logger } from '@nestjs/common';
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
    return this.logRepository.getRecentLogs(limit);
  }
}
