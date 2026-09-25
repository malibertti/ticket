import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type AccessVerifier, JWT_VERIFIER } from './constants';
import { IS_PUBLIC } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(JWT_VERIFIER)
    private readonly verifier: AccessVerifier,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    try {
      req.user = await this.verifier.verify(header.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
