import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ServiciosApi, TallerApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { Servicio } from '../../core/models';
import { SyncService } from '../../core/sync.service';

/** Configuración del taller (solo administrador). */
@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Configuración</h1>
        <a class="btn btn-sec" routerLink="/usuarios">🔧 Personal del taller</a>
      </div>

      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }
      @if (aviso()) {
        <div class="alerta alerta-info">{{ aviso() }}</div>
      }

      <section class="card">
        <h2>Datos del taller</h2>
        <p class="item-sub" style="margin-top: 0">Aparecen en los comprobantes y presupuestos.</p>
        <div class="grid-2">
          <div class="campo">
            <label class="req" for="tn">Nombre</label>
            <input id="tn" [(ngModel)]="taller.nombre" />
          </div>
          <div class="campo">
            <label for="tt">Teléfono</label>
            <input id="tt" type="tel" [(ngModel)]="taller.telefono" />
          </div>
        </div>
        <div class="campo" style="margin-top: 12px">
          <label for="td">Dirección</label>
          <input id="td" [(ngModel)]="taller.direccion" />
        </div>
        <div class="acciones">
          <button class="btn" [disabled]="procesando() || taller.nombre.trim().length < 3" (click)="guardarTaller()">Guardar datos</button>
        </div>
      </section>

      <section class="card">
        <h2>Catálogo de servicios</h2>
        <p class="item-sub" style="margin-top: 0">
          Precios estándar de mano de obra. Al cargar un servicio en una orden se usa este precio,
          así los presupuestos no dependen de la memoria de cada mecánico.
        </p>

        <table class="tabla">
          <thead>
            <tr>
              <th>Servicio</th>
              <th class="num">Precio (Bs)</th>
              <th class="num">Horas est.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of servicios(); track s.id) {
              <tr [style.opacity]="s.activo ? 1 : 0.5">
                @if (editando() === s.id) {
                  <td><input class="mini" [(ngModel)]="form.nombre" /></td>
                  <td class="num"><input class="mini num" type="number" min="0" [(ngModel)]="form.precio" /></td>
                  <td class="num"><input class="mini num" type="number" min="0" step="0.5" [(ngModel)]="form.horasEstimadas" /></td>
                  <td class="num">
                    <button class="btn" (click)="guardarServicio(s)">✔</button>
                    <button class="btn btn-sec" (click)="editando.set(null)">✕</button>
                  </td>
                } @else {
                  <td>{{ s.nombre }}</td>
                  <td class="num">{{ s.precio | number: '1.2-2' }}</td>
                  <td class="num">{{ s.horasEstimadas ?? '—' }}</td>
                  <td class="num">
                    <button class="btn btn-sec" (click)="editar(s)">Editar</button>
                    <button class="btn btn-sec" (click)="alternar(s)">{{ s.activo ? 'Desactivar' : 'Activar' }}</button>
                  </td>
                }
              </tr>
            } @empty {
              <tr><td colspan="4" class="vacio">Aún no hay servicios. Agregue los más comunes del taller.</td></tr>
            }
          </tbody>
        </table>

        <div class="grid-2" style="margin-top: 16px">
          <div class="campo">
            <label for="sn">Nuevo servicio</label>
            <input id="sn" [(ngModel)]="nuevo.nombre" placeholder="Cambio de aceite y filtro" />
          </div>
          <div class="campo">
            <label for="sp">Precio (Bs)</label>
            <input id="sp" type="number" min="0" inputmode="decimal" [(ngModel)]="nuevo.precio" />
          </div>
          <div class="campo">
            <label for="sh">Horas estimadas</label>
            <input id="sh" type="number" min="0" step="0.5" inputmode="decimal" [(ngModel)]="nuevo.horasEstimadas" />
          </div>
          <div class="campo" style="justify-content: flex-end">
            <button class="btn" [disabled]="procesando() || nuevo.nombre.trim().length < 3 || nuevo.precio == null" (click)="crearServicio()">
              + Agregar al catálogo
            </button>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: `
    .mini {
      width: 100%;
      min-height: 36px;
      padding: 4px 8px;
      border: 1px solid var(--borde);
      border-radius: 6px;
      font: inherit;
    }
    td .btn {
      min-height: 32px;
      padding: 0 10px;
      margin-left: 4px;
    }
  `,
})
export class ConfiguracionComponent implements OnInit {
  private readonly tallerApi = inject(TallerApi);
  private readonly serviciosApi = inject(ServiciosApi);
  private readonly sync = inject(SyncService);

  readonly servicios = signal<Servicio[]>([]);
  readonly editando = signal<string | null>(null);
  readonly procesando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  taller = { nombre: '', direccion: '', telefono: '' };
  nuevo = { nombre: '', precio: null as number | null, horasEstimadas: null as number | null };
  form = { nombre: '', precio: 0, horasEstimadas: null as number | null };

  async ngOnInit() {
    try {
      const t = await firstValueFrom(this.tallerApi.obtener());
      this.taller = { nombre: t.nombre, direccion: t.direccion ?? '', telefono: t.telefono ?? '' };
      await this.cargarServicios();
    } catch (err) {
      this.error.set(mensajeError(err));
    }
  }

  guardarTaller() {
    this.ejecutar(async () => {
      await firstValueFrom(this.tallerApi.actualizar(this.taller));
      this.aviso.set('Datos del taller guardados.');
    });
  }

  crearServicio() {
    this.ejecutar(async () => {
      await firstValueFrom(
        this.serviciosApi.crear({
          nombre: this.nuevo.nombre.trim(),
          precio: Number(this.nuevo.precio),
          horasEstimadas: this.nuevo.horasEstimadas != null ? Number(this.nuevo.horasEstimadas) : null,
        }),
      );
      this.nuevo = { nombre: '', precio: null, horasEstimadas: null };
      await this.cargarServicios();
    });
  }

  editar(s: Servicio) {
    this.form = { nombre: s.nombre, precio: s.precio, horasEstimadas: s.horasEstimadas };
    this.editando.set(s.id);
  }

  guardarServicio(s: Servicio) {
    this.ejecutar(async () => {
      await firstValueFrom(
        this.serviciosApi.actualizar(s.id, {
          nombre: this.form.nombre.trim(),
          precio: Number(this.form.precio),
          horasEstimadas: this.form.horasEstimadas != null ? Number(this.form.horasEstimadas) : null,
        }),
      );
      this.editando.set(null);
      await this.cargarServicios();
    });
  }

  alternar(s: Servicio) {
    this.ejecutar(async () => {
      await firstValueFrom(this.serviciosApi.actualizar(s.id, { activo: !s.activo }));
      await this.cargarServicios();
    });
  }

  private async cargarServicios() {
    this.servicios.set(await firstValueFrom(this.serviciosApi.listar(true)));
  }

  private async ejecutar(accion: () => Promise<void>) {
    this.procesando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      await accion();
      // La copia offline (catálogo y datos del taller) se actualiza.
      await this.sync.descargarSnapshot().catch(() => {});
    } catch (err) {
      this.error.set(mensajeError(err));
    } finally {
      this.procesando.set(false);
    }
  }
}
