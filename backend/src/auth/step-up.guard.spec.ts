import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StepUpGuard } from './step-up.guard';

describe('StepUpGuard', () => {
  let guard: StepUpGuard;
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
    guard = new StepUpGuard(reflector);
  });

  it('should allow access when step-up is not required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('should allow access when step-up is not required (undefined)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('should allow access when step-up is required and user has stepUp=true', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = mockContext({ stepUp: true, roles: ['Lawyer'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when step-up is required but user has stepUp=false', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = mockContext({ stepUp: false, roles: ['Lawyer'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow('Step-up authentication required');
  });

  it('should throw ForbiddenException when step-up is required but user has no stepUp', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = mockContext({ roles: ['Lawyer'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when step-up is required but user is undefined', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = mockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
