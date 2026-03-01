import {
  Controller,
  Post,
  Body,
  Req,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Request } from 'express';

class UiErrorDto {
  @IsString() message: string;
  @IsOptional() @IsString() stack?: string;
  @IsOptional() @IsString() componentStack?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() userAgent?: string;
  @IsOptional() @IsObject() extra?: Record<string, any>;
}

/**
 * Receives client-side errors from the React ErrorBoundary
 * and logs them server-side with the correlation ID so they
 * appear in the same Loki / Grafana stream as backend errors.
 */
@Controller('telemetry')
export class TelemetryController {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Post('ui-error')
  @HttpCode(HttpStatus.NO_CONTENT)
  reportUiError(@Body() dto: UiErrorDto, @Req() req: Request): void {
    const correlationId = (req as any).correlationId || '-';
    const user = (req as any).user;

    this.logger.warn('UI error reported by client', {
      correlationId,
      source: 'frontend',
      userId: user?.sub || 'anonymous',
      tenantSlug: user?.tenantSlug || '-',
      message: dto.message,
      stack: dto.stack,
      componentStack: dto.componentStack,
      url: dto.url,
      userAgent: dto.userAgent,
      extra: dto.extra,
    });
  }
}
