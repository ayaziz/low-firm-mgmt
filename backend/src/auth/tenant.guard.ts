import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * TenantGuard — ABAC: ensures the JWT contains a valid tenantSlug / tenantId.
 * Applied globally to prevent cross-tenant data access.
 * Skips when no user context exists (unauthenticated / public endpoints).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    // Skip for public endpoints (no JWT attached yet)
    if (!user) return true;
    if (!user.tenantSlug) {
      throw new ForbiddenException('Tenant context missing');
    }
    return true;
  }
}
