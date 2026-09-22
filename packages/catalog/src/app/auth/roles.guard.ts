import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!roles?.length) {
      return true;
    }

    const user = ctx.switchToHttp().getRequest().user;
    const groups: string[] = user['cognito:groups'] ?? [];

    if (!roles.some((r) => groups.includes(r))) {
      throw new ForbiddenException();
    }

    return true;
  }
}
