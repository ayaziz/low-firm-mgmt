import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Request, Response } from 'express';

/**
 * Global HTTP logging interceptor.
 * Logs every request/response with correlation ID, user context, timing.
 * Errors are also captured with stack traces.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const start = Date.now();

    const correlationId = (req as any).correlationId || '-';
    const user = (req as any).user;

    const meta = {
      correlationId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: user?.sub || 'anonymous',
      tenantSlug: user?.tenantSlug || '-',
    };

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.info('HTTP request completed', {
          ...meta,
          statusCode: res.statusCode,
          duration,
        });
      }),
      catchError((err) => {
        const duration = Date.now() - start;
        const status =
          err instanceof HttpException
            ? err.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        this.logger.error('HTTP request failed', {
          ...meta,
          statusCode: status,
          duration,
          error: err.message,
          stack: err.stack,
        });

        return throwError(() => err);
      }),
    );
  }
}
