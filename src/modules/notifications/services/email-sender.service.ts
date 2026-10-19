import { Injectable, Logger } from '@nestjs/common';
import { NotificationJob } from '../entities/notification-job.entity.js';

@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);

  /**
   * Simulates sending an email via SMTP or 3rd party API (e.g., SendGrid, AWS SES).
   *
   * @param job NotificationJob to process
   * @throws Error when delivery fails to trigger retry/DLQ mechanism
   */
  async sendEmail(job: NotificationJob): Promise<{ messageId: string }> {
    const startTime = Date.now();

    // Simulate network transmission delay (15 - 35ms)
    const simulatedLatency = Math.floor(Math.random() * 20) + 15;
    await new Promise((resolve) => setTimeout(resolve, simulatedLatency));

    // Support deterministic testing for failure & retries:
    // If recipient email contains 'fail', trigger hard failure
    if (job.recipientEmail.includes('fail')) {
      throw new Error(
        `SMTP connection timeout to mail server for ${job.recipientEmail}`,
      );
    }

    // If recipient contains 'flaky', fail only on attempt 1, succeed on retry attempt 2
    if (job.recipientEmail.includes('flaky') && job.attempts < 2) {
      throw new Error(
        `Temporary 421 Service not available, closing transmission channel`,
      );
    }

    const messageId = `msg_${crypto.randomUUID()}`;

    // Standard prompt requirement: "Sends emails (simulated via console.log or dummy API)"
    this.logger.log(
      `[EMAIL SENT] To: ${job.recipientEmail} | Subject: Order #${job.orderId} status changed to ${job.orderStatus} | MessageID: ${messageId} | Duration: ${Date.now() - startTime}ms`,
    );

    return { messageId };
  }
}
