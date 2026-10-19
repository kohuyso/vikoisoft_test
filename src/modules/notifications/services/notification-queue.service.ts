import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { NotificationJob } from '../entities/notification-job.entity.js';
import { NotificationLogRepository } from '../repositories/notification-log.repository.js';
import { EmailSenderService } from './email-sender.service.js';

export class QueueMetrics {
  enqueuedCount!: number;
  processedSuccessCount!: number;
  retryAttemptCount!: number;
  dlqCount!: number;
  queueDepth!: number;
  activeWorkers!: number;
  maxConcurrency!: number;
}

@Injectable()
export class NotificationQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);

  // In-memory FIFO queue buffer
  private readonly queue: NotificationJob[] = [];
  // Dead Letter Queue for permanently failed jobs
  private readonly dlq: NotificationJob[] = [];

  // Concurrency controls
  private activeWorkers = 0;
  private readonly maxConcurrency = 50; // Handles ~500 req/sec comfortably with 30ms email latency

  // Metrics
  private enqueuedCount = 0;
  private processedSuccessCount = 0;
  private retryAttemptCount = 0;

  // Active timers tracking for clean teardown
  private readonly retryTimers = new Set<NodeJS.Timeout>();

  constructor(
    private readonly emailSender: EmailSenderService,
    private readonly logRepository: NotificationLogRepository,
  ) {}

  /**
   * Enqueues a notification job into the processing queue.
   */
  enqueue(
    orderId: number,
    recipientEmail: string,
    orderStatus: string,
    templateData: Record<string, unknown> = {},
    maxRetries = 3,
    initialBackoffMs = 100,
  ): NotificationJob {
    const job: NotificationJob = {
      id: crypto.randomUUID(),
      orderId,
      recipientEmail,
      orderStatus,
      templateData,
      attempts: 0,
      maxRetries,
      backoffMs: initialBackoffMs,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    this.enqueuedCount++;
    this.queue.push(job);

    // Trigger workers
    this.dispatchWorkers();

    return job;
  }

  /**
   * Dispatches workers up to maxConcurrency limit.
   */
  private dispatchWorkers(): void {
    while (this.activeWorkers < this.maxConcurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      this.activeWorkers++;
      this.processJob(job).finally(() => {
        this.activeWorkers--;
        // Immediately try processing next item
        this.dispatchWorkers();
      });
    }
  }

  /**
   * Executes individual job with error handling and retry / DLQ workflow.
   */
  private async processJob(job: NotificationJob): Promise<void> {
    job.attempts++;
    job.lastAttemptAt = new Date().toISOString();
    job.status = 'PROCESSING';
    const startTime = Date.now();

    try {
      await this.emailSender.sendEmail(job);

      const durationMs = Date.now() - startTime;
      job.status = 'SUCCESS';
      this.processedSuccessCount++;

      // Asynchronous non-blocking log
      await this.logRepository.log({
        jobId: job.id,
        orderId: job.orderId,
        recipientEmail: job.recipientEmail,
        orderStatus: job.orderStatus,
        status: 'SUCCESS',
        attempt: job.attempts,
        durationMs,
      });
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = (err as Error).message || 'Unknown email delivery error';
      job.error = errorMsg;

      if (job.attempts < job.maxRetries) {
        // Retry with exponential backoff & jitter
        this.retryAttemptCount++;
        job.status = 'RETRYING';
        const jitter = Math.floor(Math.random() * 50);
        const delay = job.backoffMs + jitter;
        job.backoffMs *= 2; // Exponential increase

        this.logger.warn(
          `Job #${job.id} for order #${job.orderId} failed (Attempt ${job.attempts}/${job.maxRetries}). Scheduling retry in ${delay}ms...`,
        );

        // Async log failure attempt
        await this.logRepository.log({
          jobId: job.id,
          orderId: job.orderId,
          recipientEmail: job.recipientEmail,
          orderStatus: job.orderStatus,
          status: 'RETRYING',
          attempt: job.attempts,
          errorMessage: errorMsg,
          durationMs,
        });

        // Re-enqueue after backoff delay
        const timer = setTimeout(() => {
          this.retryTimers.delete(timer);
          this.queue.push(job);
          this.dispatchWorkers();
        }, delay);
        this.retryTimers.add(timer);
      } else {
        // Exceeded retries -> Move to Dead Letter Queue (DLQ)
        job.status = 'FAILED_DLQ';
        this.dlq.push(job);

        this.logger.error(
          `Job #${job.id} exhausted all ${job.maxRetries} retries. Routing to Dead Letter Queue (DLQ).`,
        );

        // Async log final failure
        await this.logRepository.log({
          jobId: job.id,
          orderId: job.orderId,
          recipientEmail: job.recipientEmail,
          orderStatus: job.orderStatus,
          status: 'SENT_TO_DLQ',
          attempt: job.attempts,
          errorMessage: errorMsg,
          durationMs,
        });
      }
    }
  }

  getMetrics(): QueueMetrics {
    return {
      enqueuedCount: this.enqueuedCount,
      processedSuccessCount: this.processedSuccessCount,
      retryAttemptCount: this.retryAttemptCount,
      dlqCount: this.dlq.length,
      queueDepth: this.queue.length,
      activeWorkers: this.activeWorkers,
      maxConcurrency: this.maxConcurrency,
    };
  }

  getDLQ(): NotificationJob[] {
    return [...this.dlq];
  }

  onModuleDestroy(): void {
    for (const timer of this.retryTimers) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
  }
}
