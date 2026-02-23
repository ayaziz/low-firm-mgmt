import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../common/decorators';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockContext = (user?: any): ExecutionContext => {
    const req = { user };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('should allow access when required roles array is empty', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('should allow access when user has a required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Lawyer', 'TenantAdmin']);
    const ctx = mockContext({ roles: ['Lawyer'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when user has any one of multiple required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Accountant', 'TenantAdmin']);
    const ctx = mockContext({ roles: ['SystemAdmin', 'TenantAdmin'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user has no matching role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['TenantAdmin']);
    const ctx = mockContext({ roles: ['Lawyer'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('Insufficient permissions');
  });

  it('should throw ForbiddenException when user is undefined', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Lawyer']);
    const ctx = mockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user has no roles property', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Lawyer']);
    const ctx = mockContext({ email: 'test@example.com' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user.roles is empty', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Lawyer']);
    const ctx = mockContext({ roles: [] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
