import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RedisService, RedisStatus } from './redis.service.js';

@ApiTags('Redis Infrastructure')
@Controller('api/redis')
export class RedisController {
  constructor(private readonly redisService: RedisService) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check Redis connectivity and operational mode',
    description:
      'Returns active connection status (live Redis vs. resilient In-Memory Fallback), ping latency, and cached key counts',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Redis status returned successfully',
  })
  async getStatus(): Promise<RedisStatus> {
    return this.redisService.getStatus();
  }
}
