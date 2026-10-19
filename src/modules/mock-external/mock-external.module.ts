import { Module } from '@nestjs/common';
import { MockExternalController } from './mock-external.controller.js';

@Module({
  controllers: [MockExternalController],
})
export class MockExternalModule {}
