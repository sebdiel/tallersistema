import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AlertasApi } from './api.service';
import { Alerta } from './models';

/** Alertas del motor de reglas (RN-12, RN-13, RN-24) compartidas por el menú y la página. */
@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly api = inject(AlertasApi);

  readonly alertas = signal<Alerta[]>([]);
  readonly cantidad = computed(() => this.alertas().length);

  async cargar(): Promise<void> {
    try {
      this.alertas.set(await firstValueFrom(this.api.listar()));
    } catch {
      // Sin conexión: las alertas son del servidor; se conserva la última lista.
    }
  }

  async resolver(a: Alerta): Promise<void> {
    await firstValueFrom(this.api.resolver(a.id));
    this.alertas.update((l) => l.filter((x) => x.id !== a.id));
  }
}
