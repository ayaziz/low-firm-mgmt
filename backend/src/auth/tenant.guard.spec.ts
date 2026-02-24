import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
  let guard: TenantGuard;

  const mockContext = (user?: any): ExecutionContext => {
    const req = { user };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    guard = new TenantGuard();
  });

  it('should allow access when user has tenantSlug', () => {
    const ctx = mockContext({ tenantSlug: 'demo-firm', tenantId: '1', roles: ['Lawyer'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should skip (allow) when no user context (public endpoint)', () => {
    const ctx = mockContext(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should skip (allow) when user is null', () => {
    const ctx = mockContext(null);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user exists but has no tenantSlug', () => {
    const ctx = mockContext({ roles: ['Lawyer'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('Tenant context missing');
  });

  it('should throw ForbiddenException when tenantSlug is empty string', () => {
    const ctx = mockContext({ tenantSlug: '', roles: ['Lawyer'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
