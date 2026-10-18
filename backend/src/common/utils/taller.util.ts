import { ForbiddenException } from '@nestjs/common';
import { UsuarioActual } from '../decorators/auth.decorators';

/**
 * Devuelve el taller del usuario autenticado. Todas las consultas de datos
 * operativos se filtran por este id para aislar la información entre talleres.
 */
export function tallerDe(user: UsuarioActual): string {
  if (!user.tallerId) {
    throw new ForbiddenException('El usuario no pertenece a ningún taller');
  }
  return user.tallerId;
}
