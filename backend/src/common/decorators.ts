import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const STEP_UP_KEY = 'stepUp';
export const RequireStepUp = () => SetMetadata(STEP_UP_KEY, true);

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// ── Audit ────────────────────────────────────────────────

export const AUDIT_ACTION_KEY = 'auditAction';

export interface AuditActionMeta {
  /** Event type string, e.g. 'CASE_CREATED' */
  eventType: string;
  /** Entity type string, e.g. 'Case' */
  entityType: string;
  /** Route param name that holds the entity ID (for update / delete) */
  entityIdParam?: string;
  /** Body / response field name that holds the entity ID (for create) */
  entityIdFromBody?: string;
}

/**
 * Opt-in decorator to enable automatic audit logging on a controller method.
 * Only methods annotated with @AuditAction() will produce audit_events rows
 * via the global AuditInterceptor.
 */
export const AuditAction = (meta: AuditActionMeta) => SetMetadata(AUDIT_ACTION_KEY, meta);
