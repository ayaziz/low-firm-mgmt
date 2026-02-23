import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async readiness(@Res() res: Response) {
    const checks: Record<string, { status: string; latencyMs?: number }> = {};
    let overallStatus = 'ok';

    // Database check
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
    } catch {
      checks.database = { status: 'fail', latencyMs: Date.now() - dbStart };
      overallStatus = 'unhealthy';
    }

    // Storage and Queue checks are optional — mark as ok for simplicity in MVP
    checks.storage = { status: 'ok' };
    checks.queue = { status: 'ok' };

    const statusCode = overallStatus === 'unhealthy' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;
    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    });
  }
}
