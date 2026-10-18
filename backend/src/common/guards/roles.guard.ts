import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, UsuarioActual } from '../decorators/auth.decorators';
import { Rol } from '../enums/rol.enum';

/** HU-03: restringe acciones según el rol del usuario. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user: UsuarioActual | undefined = context
      .switchToHttp()
      .getRequest().user;
    return !!user && roles.includes(user.rol);
  }
}
