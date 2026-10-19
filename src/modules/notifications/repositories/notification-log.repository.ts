import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { NotificationLog } from '../entities/notification-log.entity.js';

@Injectable()
export class NotificationLogRepository {
  private readonly logger = new Logger(NotificationLogRepository.name);
  private readonly logs: NotificationLog[] = [];
  private readonly logFilePath = path.resolve(
    process.cwd(),
    'logs',
    'notification_audit.log',
  );
  private isLogDirReady = false;

  private async ensureLogDir(): Promise<void> {
    if (!this.isLogDirReady) {
      try {
        await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
        this.isLogDirReady = true;
      } catch (err) {
        this.logger.error(
          `Failed to create log directory: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Persists log asynchronously to memory and appends to file without blocking main flow.
   */
  async log(
    entry: Omit<NotificationLog, 'id' | 'timestamp'>,
  ): Promise<NotificationLog> {
    const fullLog: NotificationLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    // 1. In-memory storage for immediate retrieval
    this.logs.unshift(fullLog);
    if (this.logs.length > 1000) {
      this.logs.pop(); // keep memory bounded
    }

    // 2. Non-blocking asynchronous file append
    this.appendToFileAsync(fullLog);

    return fullLog;
  }

  private appendToFileAsync(log: NotificationLog): void {
    (async () => {
      try {
        await this.ensureLogDir();
        const line = JSON.stringify(log) + '\n';
        await fs.appendFile(this.logFilePath, line, 'utf-8');
      } catch (err) {
        this.logger.error(
          `Failed to write audit log to file: ${(err as Error).message}`,
        );
      }
    })();
  }

  async getRecentLogs(limit = 100): Promise<NotificationLog[]> {
    return this.logs.slice(0, limit);
  }

  async clear(): Promise<void> {
    this.logs.length = 0;
  }
}
