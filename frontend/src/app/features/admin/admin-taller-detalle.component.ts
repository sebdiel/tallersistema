import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { DetalleTaller, ESTADO_SUSCRIPCION, ROL_LABEL } from '../../core/models';

const PRECIO_MENSUAL = 90;

/** HU-26: suscripción, pagos, usuarios y soporte de un taller (SUPERADMIN). */
@Component({
  selector: 'app-admin-taller-detalle',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, DecimalPipe],
  template: `
    <div class="pagina">
      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }
      @if (aviso()) {
        <div class="alerta alerta-info">{{ aviso() }}</div>
      }

      @if (d(); as d) {
        <div class="encabezado">
          <div>
            <a routerLink="/admin/talleres">← Talleres</a>
            <h1>{{ d.taller.nombre }}</h1>
            <div class="item-sub">Cliente desde {{ d.taller.createdAt | date: 'dd/MM/yyyy' }}</div>
          </div>
          <span [class]="'estado-ot ' + info[d.suscripcion.estado].clase" style="font-size: 0.9rem">
            {{ info[d.suscripcion.estado].texto }}
          </span>
        </div>

        <div class="grid-2">
          <!-- Suscripción -->
          <section class="card">
            <h2>Suscripción</h2>
            <dl class="datos">
              <dt>Vigente hasta</dt>
              <dd>{{ d.suscripcion.vigenteHasta | date: 'dd/MM/yyyy' }}</dd>
              <dt>Días</dt>
              <dd>
                {{ d.suscripcion.diasRestantes >= 0 ? d.suscripcion.diasRestantes + ' restantes' : -d.suscripcion.diasRestantes + ' vencido' }}
              </dd>
              @if (d.taller.motivoSuspension) {
                <dt>Suspensión</dt>
                <dd>{{ d.taller.motivoSuspension }}</dd>
              }
            </dl>
            @if (d.suscripcion.mensaje) {
              <p class="item-sub">{{ d.suscripcion.mensaje }}</p>
            }

            <h2 style="margin-top: 16px">Registrar pago</h2>
            <div class="grid-2">
              <div class="campo">
                <label for="meses">Meses</label>
                <select id="meses" [(ngModel)]="pago.meses" (ngModelChange)="pago.monto = $event * precio">
                  @for (m of [1, 3, 6, 12]; track m) {
                    <option [ngValue]="m">{{ m }} {{ m === 1 ? 'mes' : 'meses' }}</option>
                  }
                </select>
              </div>
              <div class="campo">
                <label for="monto">Monto (Bs)</label>
                <input id="monto" type="number" min="0" [(ngModel)]="pago.monto" />
              </div>
              <div class="campo">
                <label for="met">Método</label>
                <select id="met" [(ngModel)]="pago.metodo">
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="QR">QR</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                </select>
              </div>
              <div class="campo">
                <label for="ref">Referencia</label>
                <input id="ref" [(ngModel)]="pago.referencia" />
              </div>
            </div>
            <div class="acciones">
              <button class="btn" [disabled]="procesando()" (click)="registrarPago()">Registrar pago</button>
            </div>

            <h2 style="margin-top: 16px">Acceso</h2>
            @if (d.taller.activo) {
              <div class="campo">
                <label for="motivo">Motivo de suspensión</label>
                <input id="motivo" [(ngModel)]="motivo" placeholder="Falta de pago, solicitud del cliente…" />
              </div>
              <div class="acciones">
                <button class="btn btn-peligro" [disabled]="procesando() || motivo.trim().length < 3" (click)="suspender()">Suspender taller</button>
              </div>
            } @else {
              <div class="acciones">
                <button class="btn" [disabled]="procesando()" (click)="reactivar()">Reactivar taller</button>
              </div>
            }
          </section>

          <!-- Datos -->
          <section class="card">
            <h2>Datos del taller</h2>
            <div class="campo"><label for="tn">Nombre</label><input id="tn" [(ngModel)]="datos.nombre" /></div>
            <div class="campo" style="margin-top: 8px"><label for="tc">Contacto</label><input id="tc" [(ngModel)]="datos.contactoNombre" /></div>
            <div class="campo" style="margin-top: 8px"><label for="tt">Teléfono</label><input id="tt" [(ngModel)]="datos.telefono" /></div>
            <div class="campo" style="margin-top: 8px"><label for="tnit">NIT</label><input id="tnit" [(ngModel)]="datos.nit" /></div>
            <div class="campo" style="margin-top: 8px"><label for="td">Dirección</label><input id="td" [(ngModel)]="datos.direccion" /></div>
            <div class="campo" style="margin-top: 8px"><label for="tno">Notas internas</label><textarea id="tno" rows="2" [(ngModel)]="datos.notas"></textarea></div>
            <div class="acciones">
              <button class="btn btn-sec" [disabled]="procesando()" (click)="guardarDatos()">Guardar datos</button>
            </div>

            <h2 style="margin-top: 16px">Uso del sistema</h2>
            <dl class="datos">
              <dt>Órdenes (30 días)</dt><dd>{{ d.uso.ot30d }}</dd>
              <dt>Órdenes en total</dt><dd>{{ d.uso.otTotal }}</dd>
              <dt>Clientes</dt><dd>{{ d.uso.clientes }}</dd>
              <dt>Vehículos</dt><dd>{{ d.uso.vehiculos }}</dd>
              <dt>Última actividad</dt>
              <dd>{{ d.uso.ultimaActividad ? (d.uso.ultimaActividad | date: 'dd/MM/yyyy HH:mm') : 'Sin uso aún' }}</dd>
            </dl>
          </section>
        </div>

        <section class="card">
          <h2>Usuarios del taller</h2>
          <table class="tabla">
            <tbody>
              @for (u of d.usuarios; track u.id) {
                <tr>
                  <td>
                    {{ u.nombre }} <span class="etiqueta">{{ rol[u.rol] }}</span>
                    @if (!u.activo) { <span class="etiqueta etiqueta-off">Inactivo</span> }
                    <div class="item-sub">{{ u.email }}</div>
                  </td>
                  <td class="num">
                    @if (reseteando() === u.id) {
                      <input class="mini" [(ngModel)]="nuevaClave" placeholder="Nueva contraseña" />
                      <button class="btn" [disabled]="nuevaClave.length < 8" (click)="resetPassword(u.id)">OK</button>
                      <button class="btn btn-sec" (click)="reseteando.set(null)">✕</button>
                    } @else {
                      <button class="btn btn-sec" (click)="reseteando.set(u.id); nuevaClave = ''">Restablecer contraseña</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>

        <section class="card">
          <h2>Historial de pagos</h2>
          <table class="tabla">
            <thead><tr><th>Fecha</th><th>Período</th><th>Método</th><th class="num">Monto (Bs)</th></tr></thead>
            <tbody>
              @for (p of d.pagos; track p.id) {
                <tr>
                  <td>{{ p.createdAt | date: 'dd/MM/yyyy' }}<div class="item-sub">{{ p.registradoPor }}</div></td>
                  <td>{{ p.desde | date: 'dd/MM/yy' }} – {{ p.hasta | date: 'dd/MM/yy' }} ({{ p.meses }} m)</td>
                  <td>{{ p.metodo }} @if (p.referencia) { · {{ p.referencia }} }</td>
                  <td class="num">{{ p.monto | number: '1.2-2' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="vacio">Sin pagos todavía (período de prueba).</td></tr>
              }
            </tbody>
          </table>
        </section>
      } @else if (!error()) {
        <p class="vacio">Cargando…</p>
      }
    </div>
  `,
  styles: `
    .mini {
      min-height: 34px;
      padding: 4px 8px;
      border: 1px solid var(--borde);
      border-radius: 6px;
      font: inherit;
      width: 170px;
    }
    td .btn {
      min-height: 32px;
      padding: 0 10px;
      margin-left: 4px;
    }
  `,
})
export class AdminTallerDetalleComponent implements OnInit {
  private readonly api = inject(AdminApi);
  readonly id = input.required<string>();
  readonly info = ESTADO_SUSCRIPCION;
  readonly rol = ROL_LABEL;
  readonly precio = PRECIO_MENSUAL;

  readonly d = signal<DetalleTaller | null>(null);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly procesando = signal(false);
  readonly reseteando = signal<string | null>(null);

  pago = { meses: 1, monto: PRECIO_MENSUAL, metodo: 'QR', referencia: '' };
  motivo = '';
  nuevaClave = '';
  datos = { nombre: '', contactoNombre: '', telefono: '', nit: '', direccion: '', notas: '' };

  async ngOnInit() {
    await this.ejecutar(this.api.detalle(this.id()));
  }

  registrarPago() {
    this.ejecutar(
      this.api.registrarPago(this.id(), { ...this.pago, monto: Number(this.pago.monto) }),
      'Pago registrado: la vigencia se extendió.',
    ).then(() => (this.pago = { meses: 1, monto: PRECIO_MENSUAL, metodo: 'QR', referencia: '' }));
  }

  suspender() {
    if (!confirm('¿Suspender el acceso de todo el personal de este taller?')) return;
    this.ejecutar(this.api.suspender(this.id(), this.motivo), 'Taller suspendido.').then(
      () => (this.motivo = ''),
    );
  }

  reactivar() {
    this.ejecutar(this.api.reactivar(this.id()), 'Taller reactivado.');
  }

  guardarDatos() {
    this.ejecutar(this.api.actualizar(this.id(), this.datos), 'Datos guardados.');
  }

  async resetPassword(usuarioId: string) {
    this.procesando.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.resetPassword(this.id(), usuarioId, this.nuevaClave));
      this.aviso.set('Contraseña restablecida. Comuníquela al usuario.');
      this.reseteando.set(null);
    } catch (err) {
      this.error.set(mensajeError(err));
    } finally {
      this.procesando.set(false);
    }
  }

  private async ejecutar(peticion: Observable<DetalleTaller>, ok?: string) {
    this.procesando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      const d = await firstValueFrom(peticion);
      this.d.set(d);
      const t = d.taller;
      this.datos = {
        nombre: t.nombre,
        contactoNombre: t.contactoNombre ?? '',
        telefono: t.telefono ?? '',
        nit: t.nit ?? '',
        direccion: t.direccion ?? '',
        notas: t.notas ?? '',
      };
      if (ok) this.aviso.set(ok);
    } catch (err) {
      this.error.set(mensajeError(err));
    } finally {
      this.procesando.set(false);
    }
  }
}
