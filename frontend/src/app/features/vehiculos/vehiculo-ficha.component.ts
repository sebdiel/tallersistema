import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VehiculosApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { FichaVehiculo } from '../../core/models';

/** HU-07: ficha técnica e historial del vehículo. */
@Component({
  selector: 'app-vehiculo-ficha',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
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
          @if (f.historial.length === 0) {
            <p class="vacio">Este vehículo todavía no tiene servicios registrados.</p>
          }
        </section>

        <div class="acciones">
          <a class="btn btn-sec" [routerLink]="['/vehiculos', f.vehiculo.id, 'editar']">Editar ficha</a>
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
  readonly ficha = signal<FichaVehiculo | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit() {
    this.api.ficha(this.id()).subscribe({
      next: (f) => this.ficha.set(f),
      error: (err) => this.error.set(mensajeError(err)),
    });
  }
}
