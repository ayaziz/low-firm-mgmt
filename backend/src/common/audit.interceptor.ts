import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTION_KEY, AuditActionMeta } from './decorators';

/**
 * Global interceptor that auto-logs audit events for methods
 * decorated with @AuditAction().
 *
 * Runs fire-and-forget AFTER the response is sent so audit
 * failures never block user requests.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get<AuditActionMeta>(AUDIT_ACTION_KEY, context.getHandler());
    if (!meta) {
      return next.handle(); // no decorator → pass through
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // Skip unauthenticated requests (e.g. if guard somehow allowed through)
    if (!user?.tenantSlug) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((responseBody) => {
        // Resolve entity ID from params, body, or response
        let entityId: string | undefined;
        if (meta.entityIdParam) {
          entityId = req.params[meta.entityIdParam];
        } else if (meta.entityIdFromBody) {
          entityId = req.body?.[meta.entityIdFromBody];
        } else if (responseBody?.data?.id) {
          entityId = responseBody.data.id;
        } else if (responseBody?.id) {
          entityId = responseBody.id;
        }

        // Fire-and-forget audit log
        this.auditService
          .log({
            tenantSlug: user.tenantSlug,
            eventType: meta.eventType,
            actorUserId: user.sub,
            entityType: meta.entityType,
            entityId: entityId || 'unknown',
            payload: {
              method: req.method,
              url: req.url,
              body: this.sanitiseBody(req.body),
            },
            correlationId: req.correlationId,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || undefined,
          })
          .catch((err) =>
            this.logger.warn(`Audit log failed for ${meta.eventType}: ${err.message}`),
          );
      }),
    );
  }

  /**
   * Strip sensitive fields from the request body before storing in audit payload.
   */
  private sanitiseBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    const clone = { ...body };
    const sensitiveKeys = ['password', 'passwordHash', 'refreshToken', 'token', 'secret'];
    for (const key of sensitiveKeys) {
      if (key in clone) {
        clone[key] = '***';
      }
    }
    return clone;
  }
}
