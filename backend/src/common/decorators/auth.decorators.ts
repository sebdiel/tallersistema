import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Rol } from '../enums/rol.enum';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marca un endpoint como accesible sin token (ej. login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restringe un endpoint a los roles indicados. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

/** Datos del usuario autenticado que viajan en el JWT. */
export interface UsuarioActual {
  id: string;
  email: string;
  rol: Rol;
  tallerId: string | null;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioActual =>
    ctx.switchToHttp().getRequest().user,
);
