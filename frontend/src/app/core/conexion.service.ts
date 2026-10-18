import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';

/**
 * Estado de conectividad del dispositivo. Decide si las operaciones van al
 * servidor o a la base local (IndexedDB).
 */
@Injectable({ providedIn: 'root' })
export class ConexionService {
  readonly enLinea = signal(navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this.enLinea.set(true));
    window.addEventListener('offline', () => this.enLinea.set(false));
  }
}

/**
 * Error por falta de conexión (no por una regla de negocio). El Service Worker
 * y el proxy de desarrollo responden 502/503/504 cuando no llegan al servidor.
 */
export function esSinConexion(err: unknown): boolean {
  return err instanceof HttpErrorResponse && [0, 502, 503, 504].includes(err.status);
}
