import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ResultadoSync, SyncApi } from './api.service';
import { AuthService } from './auth.service';
import { ConexionService, esSinConexion } from './conexion.service';
import { Conflicto, OperacionPendiente, db } from './db';

const INTERVALO_REINTENTO_MS = 30_000;

/**
 * HU-16: sincronización automática.
 *
 * Toda operación de órdenes de trabajo pasa por una cola en IndexedDB. Con
 * conexión se envía al instante; sin conexión espera y se envía sola cuando
 * vuelve internet. El servidor procesa cada operación una sola vez (id único),
 * así que reintentar nunca duplica datos.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly api = inject(SyncApi);
  private readonly auth = inject(AuthService);
  private readonly conexion = inject(ConexionService);

  readonly pendientes = signal(0);
  readonly conflictos = signal(0);
  readonly sincronizando = signal(false);
  readonly ultimaSync = signal<Date | null>(null);

  /** Las sincronizaciones se encadenan para que nunca corran dos a la vez. */
  private cadena: Promise<unknown> = Promise.resolve();
  private iniciado = false;

  /** Se llama una vez al entrar a la aplicación. */
  iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;

    db.meta.get('ultimaSync').then((m) => m && this.ultimaSync.set(new Date(m.valor)));
    this.actualizarContadores().then(() => this.sincronizar({ snapshot: true }));

    window.addEventListener('online', () => this.sincronizar({ snapshot: true }));
    setInterval(() => {
      if (this.pendientes() > 0) this.sincronizar({ snapshot: true });
    }, INTERVALO_REINTENTO_MS);
  }

  /** Agrega operaciones a la cola local, en orden. */
  async encolar(ops: Omit<OperacionPendiente, 'creadaEn' | 'usuarioId'>[]) {
    const usuarioId = this.auth.usuario()!.id;
    await db.cola.bulkAdd(
      ops.map((op) => ({ ...op, usuarioId, creadaEn: this.marcaDeTiempo() })),
    );
    await this.actualizarContadores();
  }

  /**
   * La cola se ordena por `creadaEn`; se garantiza que cada marca sea mayor
   * que la anterior aunque se encolen varias operaciones en el mismo milisegundo.
   */
  private ultimaMarca = 0;
  private marcaDeTiempo() {
    this.ultimaMarca = Math.max(Date.now(), this.ultimaMarca + 1);
    return new Date(this.ultimaMarca).toISOString();
  }

  async hayPendientes(): Promise<boolean> {
    return (await this.colaDelUsuario()).length > 0;
  }

  /**
   * Envía la cola al servidor. Devuelve el resultado de cada operación
   * enviada (las que no se pudieron enviar no aparecen).
   */
  sincronizar(opciones: { snapshot?: boolean } = {}): Promise<Map<string, ResultadoSync>> {
    const tarea = this.cadena.then(() => this.ejecutar(opciones.snapshot ?? false));
    this.cadena = tarea.catch(() => undefined);
    return tarea;
  }

  /** Descarga los datos del taller para poder trabajar sin conexión. */
  async descargarSnapshot() {
    const s = await firstValueFrom(this.api.snapshot());
    await db.transaction(
      'rw',
      [db.clientes, db.vehiculos, db.repuestos, db.ordenes, db.personal, db.meta],
      async () => {
        await Promise.all([
          db.clientes.clear(),
          db.vehiculos.clear(),
          db.repuestos.clear(),
          db.ordenes.clear(),
          db.personal.clear(),
        ]);
        await Promise.all([
          db.clientes.bulkPut(s.clientes),
          db.vehiculos.bulkPut(s.vehiculos),
          db.repuestos.bulkPut(s.repuestos),
          db.ordenes.bulkPut(s.ordenes),
          db.personal.bulkPut(s.personal),
          db.meta.put({ clave: 'ultimaSync', valor: s.generadoEn }),
        ]);
      },
    );
    this.ultimaSync.set(new Date(s.generadoEn));
  }

  listarPendientes() {
    return this.colaDelUsuario();
  }

  listarConflictos() {
    return db.conflictos.orderBy('creadaEn').toArray();
  }

  async descartarConflicto(id: string) {
    await db.conflictos.delete(id);
    await this.actualizarContadores();
  }

  /** Al cerrar sesión se borra la copia local (la cola pendiente se conserva). */
  async limpiarCache() {
    await Promise.all([
      db.clientes.clear(),
      db.vehiculos.clear(),
      db.repuestos.clear(),
      db.ordenes.clear(),
      db.personal.clear(),
      db.meta.clear(),
    ]);
    this.ultimaSync.set(null);
  }

  // ------------------------------------------------------------------------

  private async ejecutar(conSnapshot: boolean) {
    const resultados = new Map<string, ResultadoSync>();
    if (!this.conexion.enLinea() || !this.auth.autenticado()) return resultados;

    this.sincronizando.set(true);
    try {
      const cola = await this.colaDelUsuario();
      if (cola.length > 0) {
        const { resultados: lista } = await firstValueFrom(
          this.api.enviar(
            cola.map(({ id, tipo, ref, datos, creadaEn }) => ({ id, tipo, ref, datos, creadaEn })),
          ),
        );
        for (const r of lista) {
          resultados.set(r.id, r);
          if (r.reintentar) break;
          const op = cola.find((o) => o.id === r.id)!;
          await db.transaction('rw', db.cola, db.conflictos, async () => {
            await db.cola.delete(r.id);
            if (!r.ok) {
              const conflicto: Conflicto = {
                ...op,
                error: r.error ?? 'Rechazado por el servidor',
                detectadoEn: new Date().toISOString(),
              };
              await db.conflictos.put(conflicto);
            }
          });
        }
      }

      // Con la cola vacía, la copia local se reemplaza por la verdad del servidor.
      // (Tras una acción puntual del usuario, DatosService refresca solo lo afectado.)
      const vacia = (await this.colaDelUsuario()).length === 0;
      if (vacia && conSnapshot) await this.descargarSnapshot();
    } catch (err) {
      // Sin conexión real: se reintentará más tarde.
      if (!esSinConexion(err)) console.error(err);
    } finally {
      await this.actualizarContadores();
      this.sincronizando.set(false);
    }
    return resultados;
  }

  private colaDelUsuario() {
    const usuarioId = this.auth.usuario()?.id;
    return db.cola
      .orderBy('creadaEn')
      .filter((op) => op.usuarioId === usuarioId)
      .toArray();
  }

  private async actualizarContadores() {
    this.pendientes.set((await this.colaDelUsuario()).length);
    this.conflictos.set(await db.conflictos.count());
  }
}
