import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { esSinConexion } from './conexion.service';

/** Agrega el token JWT y cierra la sesión si el servidor la rechaza. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.endsWith('/auth/login')) {
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};

/** Convierte un error HTTP en un mensaje legible para el usuario. */
export function mensajeError(err: unknown): string {
  if (esSinConexion(err)) return 'Sin conexión con el servidor';
  if (err instanceof HttpErrorResponse) {
    const msg = err.error?.message;
    if (Array.isArray(msg)) return msg.join('. ');
    if (typeof msg === 'string') return msg;
  }
  // Reglas validadas en el dispositivo (modo offline).
  if (err instanceof Error && err.message) return err.message;
  return 'Ocurrió un error inesperado';
}
