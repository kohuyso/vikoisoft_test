import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NotificationQueueService } from './services/notification-queue.service.js';
import { EmailSenderService } from './services/email-sender.service.js';
import { NotificationLogRepository } from './repositories/notification-log.repository.js';

describe('NotificationQueueService', () => {
  let queueService: NotificationQueueService;
  let emailSender: EmailSenderService;
  let logRepo: NotificationLogRepository;

  beforeEach(() => {
    emailSender = new EmailSenderService();
    logRepo = new NotificationLogRepository();
    queueService = new NotificationQueueService(emailSender, logRepo);
  });

  afterEach(() => {
    queueService.onModuleDestroy();
  });

  it('should enqueue a job and process it successfully', async () => {
    const job = queueService.enqueue(101, 'user@example.com', 'CONFIRMED');

    expect(job.id).toBeDefined();
    expect(['PENDING', 'PROCESSING', 'SUCCESS']).toContain(job.status);

    // Wait briefly for worker to complete
    await new Promise((r) => setTimeout(r, 60));

    const metrics = queueService.getMetrics();
    expect(metrics.enqueuedCount).toBe(1);
    expect(metrics.processedSuccessCount).toBe(1);
    expect(metrics.dlqCount).toBe(0);

    const logs = await logRepo.getRecentLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('SUCCESS');
    expect(logs[0].recipientEmail).toBe('user@example.com');
  });

  it('should retry a flaky job and succeed on subsequent attempt', async () => {
    // flaky email fails on attempt 1, succeeds on attempt 2
    queueService.enqueue(
      102,
      'flaky_user@example.com',
      'PROCESSING',
      {},
      3,
      20,
    );

    // Wait for initial failure + retry backoff (20ms) + successful second run
    await new Promise((r) => setTimeout(r, 300));

    const metrics = queueService.getMetrics();
    expect(metrics.processedSuccessCount).toBe(1);
    expect(metrics.retryAttemptCount).toBeGreaterThanOrEqual(1);
    expect(metrics.dlqCount).toBe(0);
  });

  it('should route permanently failing jobs to DLQ after exhausting retries', async () => {
    // 'fail' email fails consistently on all attempts
    queueService.enqueue(103, 'fail_user@example.com', 'CANCELLED', {}, 2, 10);

    // Wait for all retries to exhaust
    await new Promise((r) => setTimeout(r, 300));

    const metrics = queueService.getMetrics();
    expect(metrics.dlqCount).toBe(1);
    expect(metrics.processedSuccessCount).toBe(0);

    const dlq = queueService.getDLQ();
    expect(dlq.length).toBe(1);
    expect(dlq[0].recipientEmail).toBe('fail_user@example.com');
    expect(dlq[0].status).toBe('FAILED_DLQ');
    expect(dlq[0].attempts).toBe(2);
  });

  it('should handle burst of concurrent jobs up to maxConcurrency without deadlock', async () => {
    const burstCount = 30;
    for (let i = 1; i <= burstCount; i++) {
      queueService.enqueue(1000 + i, `burst_${i}@example.com`, 'SHIPPED');
    }

    // Give worker pool time to process all concurrent jobs
    await new Promise((r) => setTimeout(r, 400));

    const metrics = queueService.getMetrics();
    expect(metrics.enqueuedCount).toBe(burstCount);
    expect(metrics.processedSuccessCount).toBe(burstCount);
    expect(metrics.queueDepth).toBe(0);
  });
});
