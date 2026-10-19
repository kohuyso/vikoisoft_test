import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Mock External API')
@Controller('mock/external')
export class MockExternalController {
  private readonly statsMap: Record<number, { activity_count: number }> = {
    1: { activity_count: 42 },
    2: { activity_count: 31 },
    3: { activity_count: 17 },
  };

  @Get(':userId')
  @ApiOperation({
    summary: 'Simulated external API with random 2-5s delay',
    description: 'Returns recent activity stats for a given user ID',
  })
  @ApiQuery({
    name: 'delayMs',
    required: false,
    description: 'Optional custom delay in ms for testing purposes',
  })
  @ApiResponse({
    status: 200,
    description: 'User activity statistics',
    schema: {
      example: { activity_count: 42 },
    },
  })
  async getUserStats(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('delayMs') customDelay?: string,
  ): Promise<{ activity_count: number }> {
    // 2 - 5s delay as requested in test prompt (or customDelay for fast tests)
    const delay = customDelay
      ? parseInt(customDelay, 10)
      : Math.floor(Math.random() * 3000) + 2000;

    await new Promise((resolve) => setTimeout(resolve, delay));

    return this.statsMap[userId] || { activity_count: 0 };
  }
}
