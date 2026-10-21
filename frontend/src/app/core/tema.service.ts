import { Injectable, signal } from '@angular/core';

export type Tema = 'claro' | 'industrial';

/** Tema visual: claro ("Taller PWA Claro") o industrial (oscuro). */
@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly tema = signal<Tema>(document.documentElement.dataset['tema'] === 'industrial' ? 'industrial' : 'claro');

  cambiar(): void {
    const nuevo: Tema = this.tema() === 'claro' ? 'industrial' : 'claro';
    this.tema.set(nuevo);
    document.documentElement.dataset['tema'] = nuevo;
    try {
      localStorage.setItem('tema', nuevo);
    } catch {}
  }
}
