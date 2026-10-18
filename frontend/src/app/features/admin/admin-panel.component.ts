import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { ESTADO_SUSCRIPCION, EstadoSuscripcion, ResumenGlobal } from '../../core/models';

/** HU-28: panel global del sistema comercial (SUPERADMIN). */
@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Panel global</h1>
        <a class="btn" routerLink="/admin/talleres/nuevo">+ Nuevo taller</a>
      </div>

      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }

      @if (r(); as r) {
        <div class="kpis">
          <div class="card kpi">
            <div class="kpi-titulo">Talleres</div>
            <div class="kpi-valor">{{ r.talleres }}</div>
            <div class="kpi-ayuda">{{ r.habilitados }} habilitados</div>
          </div>
          <div class="card kpi">
            <div class="kpi-titulo">Ingreso mensual recurrente</div>
            <div class="kpi-valor">Bs {{ r.ingresoRecurrente | number: '1.2-2' }}</div>
            <div class="kpi-ayuda">{{ r.habilitados }} × Bs {{ r.precioMensual | number: '1.0-0' }}/mes</div>
          </div>
          <div class="card kpi">
            <div class="kpi-titulo">Cobrado este mes</div>
            <div class="kpi-valor">Bs {{ r.ingresos.mes | number: '1.2-2' }}</div>
            <div class="kpi-ayuda">Mes anterior: Bs {{ r.ingresos.mesAnterior | number: '1.2-2' }}</div>
          </div>
          <div class="card kpi">
            <div class="kpi-titulo">Cobrado en total</div>
            <div class="kpi-valor">Bs {{ r.ingresos.total | number: '1.2-2' }}</div>
            <div class="kpi-ayuda">Desde el inicio del servicio</div>
          </div>
        </div>

        <section class="card">
          <h2>Talleres por estado de suscripción</h2>
          <div class="estados">
            @for (e of estados; track e) {
              <div class="estado-item">
                <span class="cifra">{{ r.porEstado[e] }}</span>
                <span [class]="'estado-ot ' + info[e].clase">{{ info[e].texto }}</span>
              </div>
            }
          </div>
        </section>

        <section class="card">
          <h2>Requieren atención (cobranza)</h2>
          <ul class="lista">
            @for (t of r.atencion; track t.id) {
              <li>
                <a class="item" style="box-shadow: none; border: 1px solid var(--borde)" [routerLink]="['/admin/talleres', t.id]">
                  <div>
                    <div class="item-titulo">{{ t.nombre }}</div>
                    <div class="item-sub">
                      Vence {{ t.suscripcion.vigenteHasta | date: 'dd/MM/yyyy' }} ·
                      {{ t.contactoNombre ?? t.adminEmail }} @if (t.telefono) { · {{ t.telefono }} }
                    </div>
                  </div>
                  <span [class]="'estado-ot ' + info[t.suscripcion.estado].clase">
                    {{ info[t.suscripcion.estado].texto }}
                    ({{ t.suscripcion.diasRestantes >= 0 ? t.suscripcion.diasRestantes + ' d' : -t.suscripcion.diasRestantes + ' d vencido' }})
                  </span>
                </a>
              </li>
            } @empty {
              <li class="vacio">✔ Todos los talleres están al día.</li>
            }
          </ul>
        </section>

        <section class="card">
          <h2>Cobros por mes (últimos 6 meses)</h2>
          <table class="tabla">
            <thead><tr><th>Mes</th><th class="num">Pagos</th><th class="num">Monto (Bs)</th></tr></thead>
            <tbody>
              @for (m of r.ingresos.porMes; track m.mes) {
                <tr><td>{{ m.mes + '-01' | date: 'MMMM yyyy' }}</td><td class="num">{{ m.pagos }}</td><td class="num">{{ m.monto | number: '1.2-2' }}</td></tr>
              } @empty {
                <tr><td colspan="3" class="vacio">Aún no hay pagos de suscripción.</td></tr>
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
    .kpis {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-bottom: 16px;
    }
    @media (min-width: 900px) {
      .kpis {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
    .kpi {
      margin: 0;
    }
    .kpi-titulo,
    .kpi-ayuda {
      font-size: 0.8rem;
      color: var(--texto-suave);
    }
    .kpi-valor {
      font-size: 1.4rem;
      font-weight: 700;
      margin: 4px 0;
    }
    .estados {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
    }
    .estado-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px;
      border: 1px solid var(--borde);
      border-radius: 8px;
    }
    .cifra {
      font-size: 1.6rem;
      font-weight: 700;
    }
  `,
})
export class AdminPanelComponent implements OnInit {
  private readonly api = inject(AdminApi);
  readonly r = signal<ResumenGlobal | null>(null);
  readonly error = signal<string | null>(null);
  readonly info = ESTADO_SUSCRIPCION;
  readonly estados = Object.keys(ESTADO_SUSCRIPCION) as EstadoSuscripcion[];

  async ngOnInit() {
    try {
      this.r.set(await firstValueFrom(this.api.resumen()));
    } catch (err) {
      this.error.set(mensajeError(err));
    }
  }
}
