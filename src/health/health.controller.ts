import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { ReadinessReport } from './health.indicator';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('healthz')
  @HttpCode(200)
  liveness(): { status: 'ok'; uptime_seconds: number } {
    return {
      status: 'ok',
      uptime_seconds: this.health.getUptimeSeconds(),
    };
  }

  @Get('readyz')
  async readiness(@Res({ passthrough: true }) response: Response): Promise<ReadinessReport> {
    const report = await this.health.checkReadiness();

    if (report.status === 'down') {
      response.status(503);
    }

    return report;
  }
}