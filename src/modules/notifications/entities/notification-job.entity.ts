export type JobStatus =
  'PENDING' | 'PROCESSING' | 'SUCCESS' | 'RETRYING' | 'FAILED_DLQ';

export interface NotificationJob {
  id: string;
  orderId: number;
  recipientEmail: string;
  orderStatus: string;
  templateData: Record<string, unknown>;
  attempts: number;
  maxRetries: number;
  backoffMs: number;
  status: JobStatus;
  createdAt: string;
  lastAttemptAt?: string;
  error?: string;
}
