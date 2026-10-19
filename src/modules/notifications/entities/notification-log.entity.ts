export type AuditLogStatus = 'SUCCESS' | 'FAILED' | 'RETRYING' | 'SENT_TO_DLQ';

export interface NotificationLog {
  id: string;
  jobId: string;
  orderId: number;
  recipientEmail: string;
  orderStatus: string;
  status: AuditLogStatus;
  attempt: number;
  errorMessage?: string;
  durationMs: number;
  timestamp: string;
}
