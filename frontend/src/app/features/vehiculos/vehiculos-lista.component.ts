import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { VehiculosApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { Vehiculo } from '../../core/models';

/** HU-07: búsqueda rápida de vehículos por placa. */
@Component({
  selector: 'app-vehiculos-lista',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Vehículos</h1>
        <a class="btn" routerLink="/vehiculos/nuevo">+ Nuevo vehículo</a>
      </div>

      <input
        class="buscador"
        type="search"
        placeholder="Buscar por placa, marca o modelo…"
        autocapitalize="characters"
        [formControl]="busqueda"
      />

      @if (error()) {
        <div class="alerta alerta-error" style="margin-top: 12px">{{ error() }}</div>
      }

      <ul class="lista" style="margin-top: 12px">
        @if (cargando()) {
          <li class="vacio">Buscando…</li>
        } @else {
          @for (v of vehiculos(); track v.id) {
            <li>
              <a class="item" [routerLink]="['/vehiculos', v.id]">
                <div>
                  <div class="item-titulo">{{ v.marca }} {{ v.modelo }} {{ v.anio ?? '' }}</div>
                  <div class="item-sub">👤 {{ v.cliente?.nombre }} · {{ v.kilometraje }} km</div>
                </div>
                <span class="placa">{{ v.placa }}</span>
              </a>
            </li>
          } @empty {
            <li class="vacio">No se encontraron vehículos.</li>
          }
        }
      </ul>
    </div>
  `,
})
export class VehiculosListaComponent {
  private readonly api = inject(VehiculosApi);

  readonly busqueda = new FormControl('', { nonNullable: true });
  readonly vehiculos = signal<Vehiculo[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.busqueda.valueChanges
      .pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => {
          this.cargando.set(true);
          this.error.set(null);
        }),
        switchMap((q) =>
          this.api.buscar(q).pipe(
            catchError((err) => {
              this.error.set(mensajeError(err));
              return of([]);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((lista) => {
        this.vehiculos.set(lista);
        this.cargando.set(false);
      });
  }
}
