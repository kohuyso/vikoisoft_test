import { Module } from '@nestjs/common';
import { LocalUserRepository } from './repositories/local-user.repository.js';
import { ExternalApiService } from './services/external-api.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, LocalUserRepository, ExternalApiService],
  exports: [ReportsService],
})
export class ReportsModule {}
