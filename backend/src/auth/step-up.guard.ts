import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STEP_UP_KEY } from '../common/decorators';

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresStepUp = this.reflector.getAllAndOverride<boolean>(STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresStepUp) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.stepUp) {
      throw new ForbiddenException('Step-up authentication required');
    }

    return true;
  }
}
