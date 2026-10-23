import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MergedUserReportItem } from './entities/user-report.entity.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Reports')
@Controller('api/report')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({
    summary: 'Aggregate user activities from local DB and external slow API',
    description:
      'Fetches local profiles and merges with external stats using Promise.all parallelization and timeout management',
  })
  @ApiQuery({
    name: 'forceRefresh',
    required: false,
    type: Boolean,
    description:
      'Bypass in-memory cache to measure raw parallel external network latency',
  })
  @ApiQuery({
    name: 'timeoutMs',
    required: false,
    type: Number,
    description:
      'Timeout in ms before falling back gracefully (default 4500ms)',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated report returned as fast as possible',
  })
  async getAggregatedReport(
    @Req() req: Request,
    @Query('forceRefresh') forceRefresh?: string,
    @Query('timeoutMs') timeoutMs?: string,
  ): Promise<MergedUserReportItem[]> {
    const isBypass = forceRefresh === 'true' || forceRefresh === '1';
    const parsedTimeout =
      timeoutMs && !isNaN(Number(timeoutMs)) && Number(timeoutMs) > 0
        ? parseInt(timeoutMs, 10)
        : undefined;

    // Detect server baseUrl from request
    const protocol = req.protocol || 'http';
    const host = req.get('host');
    const baseUrl = host ? `${protocol}://${host}` : undefined;

    return this.reportsService.generateAggregatedReport({
      bypassCache: isBypass,
      timeoutMs: parsedTimeout,
      baseUrl,
    });
  }
}
