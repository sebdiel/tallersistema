import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Rol } from './models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.autenticado() || inject(Router).createUrlTree(['/login']);
};

export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.autenticado() || inject(Router).createUrlTree(['/']);
};

/** HU-03: bloquea rutas según rol. Uso: canActivate: [rolGuard('ADMIN')] */
export const rolGuard =
  (...roles: Rol[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    return auth.tieneRol(...roles) || inject(Router).createUrlTree(['/']);
  };

/** El SUPERADMIN no opera un taller: su inicio es el panel global (Iteración 4). */
export const inicioPorRolGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.tieneRol('SUPERADMIN') ? inject(Router).createUrlTree(['/admin']) : true;
};
