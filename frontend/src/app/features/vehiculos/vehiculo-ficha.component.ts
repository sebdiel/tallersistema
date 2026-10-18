import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VehiculosApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { ESTADO_INFO } from '../../core/estados';
import { FichaVehiculo, formatoNumero } from '../../core/models';

/** HU-07: ficha técnica e historial del vehículo. */
@Component({
  selector: 'app-vehiculo-ficha',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe],
  template: `
    <div class="pagina">
      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }

      @if (ficha(); as f) {
        <div class="encabezado">
          <div>
            <a routerLink="/vehiculos">← Vehículos</a>
            <h1>{{ f.vehiculo.marca }} {{ f.vehiculo.modelo }}</h1>
          </div>
          <span class="placa" style="font-size: 1.3rem">{{ f.vehiculo.placa }}</span>
        </div>

        <div class="grid-2">
          <section class="card">
            <h2>Ficha técnica</h2>
            <dl class="datos">
              <dt>Año</dt>
              <dd>{{ f.vehiculo.anio ?? '—' }}</dd>
              <dt>Color</dt>
              <dd>{{ f.vehiculo.color || '—' }}</dd>
              <dt>Combustible</dt>
              <dd>{{ f.vehiculo.combustible || '—' }}</dd>
              <dt>Kilometraje</dt>
              <dd>{{ f.vehiculo.kilometraje | number }} km</dd>
              <dt>N.º chasis</dt>
              <dd>{{ f.vehiculo.nroChasis || '—' }}</dd>
            </dl>
            @if (f.vehiculo.observaciones) {
              <p class="item-sub" style="margin-top: 12px">{{ f.vehiculo.observaciones }}</p>
            }
          </section>

          <section class="card">
            <h2>Propietario</h2>
            @if (f.vehiculo.cliente; as c) {
              <dl class="datos">
                <dt>Nombre</dt>
                <dd>
                  <a [routerLink]="['/clientes', c.id]">{{ c.nombre }}</a>
                </dd>
                <dt>Teléfono</dt>
                <dd>
                  <a [href]="'tel:' + c.telefono">{{ c.telefono }}</a>
                </dd>
                <dt>CI / NIT</dt>
                <dd>{{ c.ciNit || '—' }}</dd>
              </dl>
            }
          </section>
        </div>

        <section class="card">
          <h2>Historial de servicios</h2>
          <ul class="lista">
            @for (o of f.historial; track o.id) {
              <li>
                <a class="item" style="box-shadow: none; border: 1px solid var(--borde)" [routerLink]="['/ordenes', o.id]">
                  <div>
                    <div class="item-titulo">{{ numero(o.numero) }} · {{ o.fechaIngreso | date: 'dd/MM/yyyy' }}</div>
                    <div class="item-sub">{{ o.problemaReportado }}</div>
                    @if (o.diagnostico) {
                      <div class="item-sub">🔧 {{ o.diagnostico }}</div>
                    }
                    <div class="item-sub">
                      {{ o.kilometrajeIngreso | number }} km · {{ o.repuestos?.length ?? 0 }} repuesto(s)
                      @if (o.mecanico) { · {{ o.mecanico.nombre }} }
                    </div>
                  </div>
                  <span [class]="'estado-ot ' + info[o.estado].clase">{{ info[o.estado].texto }}</span>
                </a>
              </li>
            } @empty {
              <li class="vacio">Este vehículo todavía no tiene servicios registrados.</li>
            }
          </ul>
        </section>

        <div class="acciones">
          <a class="btn btn-sec" [routerLink]="['/vehiculos', f.vehiculo.id, 'editar']">Editar ficha</a>
          <a class="btn" routerLink="/ordenes/nueva" [queryParams]="{ placa: f.vehiculo.placa }">Recibir vehículo</a>
        </div>
      } @else if (!error()) {
        <p class="vacio">Cargando…</p>
      }
    </div>
  `,
})
export class VehiculoFichaComponent implements OnInit {
  private readonly api = inject(VehiculosApi);

  readonly id = input.required<string>();
  readonly info = ESTADO_INFO;
  readonly numero = formatoNumero;
  readonly ficha = signal<FichaVehiculo | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit() {
    this.api.ficha(this.id()).subscribe({
      next: (f) => this.ficha.set(f),
      error: (err) => this.error.set(mensajeError(err)),
    });
  }
}
