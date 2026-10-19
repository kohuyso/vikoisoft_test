import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { MockExternalModule } from './modules/mock-external/mock-external.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';

@Module({
  imports: [
    OrdersModule,
    ReportsModule,
    MockExternalModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
