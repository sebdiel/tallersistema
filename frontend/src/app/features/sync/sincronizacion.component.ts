import { DatePipe } from '@angular/common';
import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { ConexionService } from '../../core/conexion.service';
import { Conflicto, OperacionPendiente } from '../../core/db';
import { SyncService } from '../../core/sync.service';

/** HU-16: estado de la sincronización offline. */
@Component({
  selector: 'app-sincronizacion',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Sincronización</h1>
        <button class="btn" [disabled]="!conexion.enLinea() || sync.sincronizando()" (click)="sincronizar()">
          {{ sync.sincronizando() ? 'Sincronizando…' : 'Sincronizar ahora' }}
        </button>
      </div>

      <section class="card">
        <dl class="datos">
          <dt>Conexión</dt>
          <dd>{{ conexion.enLinea() ? '🟢 En línea' : '🟠 Sin conexión' }}</dd>
          <dt>Última copia del servidor</dt>
          <dd>{{ sync.ultimaSync() ? (sync.ultimaSync() | date: 'dd/MM/yyyy HH:mm:ss') : 'Nunca' }}</dd>
          <dt>Pendientes de enviar</dt>
          <dd>{{ sync.pendientes() }}</dd>
        </dl>
      </section>

      @if (conflictos().length) {
        <section class="card">
          <h2>⚠ Operaciones rechazadas por el servidor</h2>
          <p class="item-sub">
            Se hicieron sin conexión, pero al sincronizar no cumplían una regla (por ejemplo, otro
            usuario ya había usado el último repuesto). Revise la orden y vuelva a registrarlo si corresponde.
          </p>
          <ul class="lista">
            @for (c of conflictos(); track c.id) {
              <li class="item" style="box-shadow: none; border: 1px solid #fecaca">
                <div>
                  <div class="item-titulo">{{ c.descripcion }}</div>
                  <div class="item-sub" style="color: var(--peligro)">{{ c.error }}</div>
                  <div class="item-sub">Hecho el {{ c.creadaEn | date: 'dd/MM HH:mm' }}</div>
                </div>
                <button class="btn btn-sec" (click)="descartar(c)">Entendido</button>
              </li>
            }
          </ul>
        </section>
      }

      <section class="card">
        <h2>Cola de operaciones</h2>
        <ul class="lista">
          @for (op of pendientes(); track op.id) {
            <li class="item" style="box-shadow: none; border: 1px solid var(--borde)">
              <div>
                <div class="item-titulo">{{ op.descripcion }}</div>
                <div class="item-sub">{{ op.creadaEn | date: 'dd/MM HH:mm:ss' }}</div>
              </div>
              <span class="pendiente-sync">pendiente</span>
            </li>
          } @empty {
            <li class="vacio">✔ Todo está sincronizado.</li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class SincronizacionComponent implements OnInit {
  readonly sync = inject(SyncService);
  readonly conexion = inject(ConexionService);

  readonly pendientes = signal<OperacionPendiente[]>([]);
  readonly conflictos = signal<Conflicto[]>([]);

  constructor() {
    effect(
      () => {
        this.sync.pendientes();
        this.sync.conflictos();
        this.cargar();
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    this.pendientes.set(await this.sync.listarPendientes());
    this.conflictos.set(await this.sync.listarConflictos());
  }

  async sincronizar() {
    await this.sync.sincronizar({ snapshot: true });
  }

  async descartar(c: Conflicto) {
    await this.sync.descartarConflicto(c.id);
  }
}
