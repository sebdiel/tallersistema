import { Injectable, signal } from '@angular/core';

/**
 * Estado de conectividad del dispositivo. En la Iteración 2 se usará para
 * decidir si las operaciones van al servidor o a IndexedDB.
 */
@Injectable({ providedIn: 'root' })
export class ConexionService {
  readonly enLinea = signal(navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this.enLinea.set(true));
    window.addEventListener('offline', () => this.enLinea.set(false));
  }
}
