import { Module } from '@nestjs/common';
import { EmailSenderService } from './services/email-sender.service.js';
import { NotificationLogRepository } from './repositories/notification-log.repository.js';
import { NotificationQueueService } from './services/notification-queue.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationQueueService,
    EmailSenderService,
    NotificationLogRepository,
  ],
  exports: [NotificationsService, NotificationQueueService],
})
export class NotificationsModule {}
