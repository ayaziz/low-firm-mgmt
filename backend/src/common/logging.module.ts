import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const { combine, timestamp, json, errors } = winston.format;

/**
 * Global structured-logging module.
 * All logs are emitted as JSON with correlation-id, tenantSlug, userId, etc.
 *
 * In production, ship stdout to Loki via Promtail or Docker log driver.
 */
@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      level: process.env.LOG_LEVEL || 'info',
      format: combine(
        errors({ stack: true }),
        timestamp(),
        json(),
      ),
      defaultMeta: { service: 'loma-backend' },
      transports: [
        new winston.transports.Console(),
      ],
    }),
  ],
})
export class LoggingModule {}
