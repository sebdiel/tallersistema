import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../../core/auth.interceptor';
import { calcularTotales } from '../../core/costos';
import { DatosService } from '../../core/datos.service';
import { ESTADO_INFO } from '../../core/estados';
import { OrdenTrabajo, Taller, formatoNumero } from '../../core/models';

/**
 * HU-20: comprobante de servicio / presupuesto imprimible (o PDF con
 * "Guardar como PDF" del navegador). Es un documento de control interno:
 * el sistema no emite facturas del SIN (límite del proyecto).
 */
@Component({
  selector: 'app-comprobante',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: `
    <div class="barra-acciones no-imprimir">
      <a class="btn btn-sec" [routerLink]="['/ordenes', id()]">← Volver</a>
      <button class="btn" (click)="imprimir()">🖨 Imprimir / Guardar PDF</button>
    </div>

    @if (error()) {
      <div class="alerta alerta-error no-imprimir" style="margin: 16px">{{ error() }}</div>
    }

    @if (orden(); as o) {
      <article class="hoja">
        <header class="cabecera">
          <div>
            <h1>{{ taller()?.nombre ?? 'Taller mecánico' }}</h1>
            @if (taller()?.direccion) {
              <div>{{ taller()?.direccion }}</div>
            }
            @if (taller()?.telefono) {
              <div>Tel.: {{ taller()?.telefono }}</div>
            }
          </div>
          <div class="titulo-doc">
            <div class="tipo">{{ esPresupuesto() ? 'PRESUPUESTO' : 'COMPROBANTE DE SERVICIO' }}</div>
            <div class="numero">{{ numero(o.numero) }}</div>
            <div>{{ (o.fechaEntrega ?? o.fechaTerminado ?? o.fechaIngreso) | date: 'dd/MM/yyyy' }}</div>
            <div class="estado">{{ info[o.estado].texto }}</div>
          </div>
        </header>

        <section class="dos-col">
          <div>
            <h2>Cliente</h2>
            <div><strong>{{ o.cliente?.nombre }}</strong></div>
            @if (o.cliente?.ciNit) {
              <div>CI/NIT: {{ o.cliente?.ciNit }}</div>
            }
            <div>Tel.: {{ o.cliente?.telefono }}</div>
          </div>
          <div>
            <h2>Vehículo</h2>
            <div>
              <strong>{{ o.vehiculo?.placa }}</strong> — {{ o.vehiculo?.marca }} {{ o.vehiculo?.modelo }}
              {{ o.vehiculo?.anio ?? '' }}
            </div>
            <div>Kilometraje: {{ o.kilometrajeIngreso | number }} km</div>
            <div>Ingreso: {{ o.fechaIngreso | date: 'dd/MM/yyyy HH:mm' }}</div>
          </div>
        </section>

        <section>
          <h2>Trabajo</h2>
          <p><strong>Motivo de ingreso:</strong> {{ o.problemaReportado }}</p>
          @if (o.diagnostico) {
            <p><strong>Diagnóstico:</strong> {{ o.diagnostico }}</p>
          }
        </section>

        <table class="detalle">
          <thead>
            <tr>
              <th>Concepto</th>
              <th class="num">Cant.</th>
              <th class="num">P. unit.</th>
              <th class="num">Importe (Bs)</th>
            </tr>
          </thead>
          <tbody>
            @for (l of o.repuestos ?? []; track l.id) {
              <tr>
                <td>{{ l.repuesto?.nombre }} <span class="codigo">{{ l.repuesto?.codigo }}</span></td>
                <td class="num">{{ l.cantidad }} {{ l.repuesto?.unidad?.toLowerCase() }}</td>
                <td class="num">{{ l.precioUnitario | number: '1.2-2' }}</td>
                <td class="num">{{ l.cantidad * l.precioUnitario | number: '1.2-2' }}</td>
              </tr>
            }
            @for (l of o.manoObra ?? []; track l.id) {
              <tr>
                <td>Mano de obra: {{ l.descripcion }}</td>
                <td class="num">1</td>
                <td class="num">{{ l.monto | number: '1.2-2' }}</td>
                <td class="num">{{ l.monto | number: '1.2-2' }}</td>
              </tr>
            }
            @if (!(o.repuestos?.length || o.manoObra?.length)) {
              <tr><td colspan="4" class="vacio">Sin conceptos registrados todavía.</td></tr>
            }
          </tbody>
        </table>

        @if (totales(); as t) {
          <table class="totales">
            <tr><td>Repuestos</td><td class="num">{{ t.repuestos | number: '1.2-2' }}</td></tr>
            <tr><td>Mano de obra</td><td class="num">{{ t.manoObra | number: '1.2-2' }}</td></tr>
            @if (t.descuento > 0) {
              <tr><td>Descuento</td><td class="num">− {{ t.descuento | number: '1.2-2' }}</td></tr>
            }
            <tr class="total"><td>TOTAL Bs</td><td class="num">{{ t.total | number: '1.2-2' }}</td></tr>
            @if (!esPresupuesto()) {
              <tr><td>Pagado</td><td class="num">{{ t.pagado | number: '1.2-2' }}</td></tr>
              <tr class="total"><td>SALDO Bs</td><td class="num">{{ t.saldo | number: '1.2-2' }}</td></tr>
            }
          </table>
        }

        @if (!esPresupuesto() && pagosVigentes().length) {
          <section>
            <h2>Pagos recibidos</h2>
            @for (p of pagosVigentes(); track p.id) {
              <div>
                {{ p.fecha | date: 'dd/MM/yyyy' }} — {{ p.metodo }}
                @if (p.referencia) { ({{ p.referencia }}) }
                : Bs {{ p.monto | number: '1.2-2' }}
              </div>
            }
          </section>
        }

        <div class="firmas">
          <div>Recibí conforme — Cliente</div>
          <div>{{ taller()?.nombre ?? 'Taller' }}</div>
        </div>

        <footer class="pie">
          Documento de control interno. <strong>No válido como factura.</strong>
          @if (esPresupuesto()) {
            Presupuesto referencial: el costo final puede variar según el trabajo realizado.
          }
        </footer>
      </article>
    } @else if (!error()) {
      <p class="vacio">Cargando…</p>
    }
  `,
  styles: `
    :host {
      display: block;
      background: var(--fondo);
      min-height: 100vh;
      padding-bottom: 24px;
    }
    .barra-acciones {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 16px;
      background: var(--superficie);
      border-bottom: 1px solid var(--borde);
    }
    .hoja {
      max-width: 800px;
      margin: 16px auto;
      background: #fff;
      color: #111;
      padding: 32px;
      box-shadow: var(--sombra);
      font-size: 0.92rem;
    }
    h1 {
      font-size: 1.3rem;
    }
    h2 {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #555;
      margin: 18px 0 6px;
    }
    p {
      margin: 4px 0;
    }
    .cabecera {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 2px solid #111;
      padding-bottom: 12px;
    }
    .titulo-doc {
      text-align: right;
    }
    .tipo {
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .numero {
      font-size: 1.4rem;
      font-weight: 700;
    }
    .estado {
      font-size: 0.8rem;
      color: #555;
    }
    .dos-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .detalle,
    .totales {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    .detalle th,
    .detalle td {
      border-bottom: 1px solid #ddd;
      padding: 6px 4px;
      text-align: left;
    }
    .detalle th {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: #555;
    }
    .codigo {
      color: #777;
      font-size: 0.8rem;
    }
    .num {
      text-align: right !important;
      font-variant-numeric: tabular-nums;
    }
    .totales {
      width: 280px;
      margin-left: auto;
    }
    .totales td {
      padding: 4px;
    }
    .totales .total td {
      font-weight: 700;
      border-top: 1px solid #111;
    }
    .firmas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      margin-top: 56px;
      text-align: center;
      font-size: 0.8rem;
    }
    .firmas div {
      border-top: 1px solid #111;
      padding-top: 6px;
    }
    .pie {
      margin-top: 24px;
      font-size: 0.75rem;
      color: #555;
      text-align: center;
    }
    @media (max-width: 600px) {
      .hoja {
        padding: 16px;
        margin: 0;
      }
      .dos-col {
        grid-template-columns: 1fr;
      }
    }
    @media print {
      :host {
        background: #fff;
      }
      .no-imprimir {
        display: none !important;
      }
      .hoja {
        box-shadow: none;
        margin: 0;
        padding: 0;
        max-width: none;
      }
    }
  `,
})
export class ComprobanteComponent implements OnInit {
  private readonly datos = inject(DatosService);

  readonly id = input.required<string>();
  readonly info = ESTADO_INFO;
  readonly numero = formatoNumero;
  readonly orden = signal<OrdenTrabajo | null>(null);
  readonly taller = signal<Taller | null>(null);
  readonly error = signal<string | null>(null);

  /** Antes de terminar el trabajo el documento es un presupuesto. */
  readonly esPresupuesto = computed(() => {
    const e = this.orden()?.estado;
    return e !== 'TERMINADO' && e !== 'ENTREGADO';
  });
  readonly totales = computed(() => {
    const o = this.orden();
    return o ? (o.totales ?? calcularTotales(o)) : null;
  });
  readonly pagosVigentes = computed(() => (this.orden()?.pagos ?? []).filter((p) => !p.anulado));

  async ngOnInit() {
    try {
      this.orden.set(await this.datos.obtenerOrden(this.id()));
      this.taller.set(await this.datos.taller());
    } catch (err) {
      this.error.set(mensajeError(err));
    }
  }

  imprimir() {
    window.print();
  }
}
