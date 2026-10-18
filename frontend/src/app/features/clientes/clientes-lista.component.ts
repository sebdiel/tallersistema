import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { ClientesApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { Cliente } from '../../core/models';

/** HU-05: listado y búsqueda de clientes. */
@Component({
  selector: 'app-clientes-lista',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Clientes</h1>
        <a class="btn" routerLink="/clientes/nuevo">+ Nuevo cliente</a>
      </div>

      <input
        class="buscador"
        type="search"
        placeholder="Buscar por nombre, CI/NIT o teléfono…"
        [formControl]="busqueda"
      />

      <div style="margin: 12px 0">
        <label>
          <input type="checkbox" [formControl]="verInactivos" /> Mostrar desactivados
        </label>
      </div>

      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }

      @if (cargando()) {
        <p class="vacio">Buscando…</p>
      } @else {
        <ul class="lista">
          @for (c of clientes(); track c.id) {
            <li>
              <a class="item" [routerLink]="['/clientes', c.id]">
                <div>
                  <div class="item-titulo">{{ c.nombre }}</div>
                  <div class="item-sub">
                    📞 {{ c.telefono }}
                    @if (c.ciNit) {
                      · CI/NIT {{ c.ciNit }}
                    }
                  </div>
                </div>
                <div>
                  @if (!c.activo) {
                    <span class="etiqueta etiqueta-off">Desactivado</span>
                  }
                  <span class="etiqueta">🚗 {{ c.totalVehiculos ?? 0 }}</span>
                </div>
              </a>
            </li>
          } @empty {
            <li class="vacio">No se encontraron clientes.</li>
          }
        </ul>
      }
    </div>
  `,
})
export class ClientesListaComponent {
  private readonly api = inject(ClientesApi);

  readonly busqueda = new FormControl('', { nonNullable: true });
  readonly verInactivos = new FormControl(false, { nonNullable: true });
  readonly clientes = signal<Cliente[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    combineLatest([
      this.busqueda.valueChanges.pipe(
        startWith(this.busqueda.value),
        debounceTime(300),
        distinctUntilChanged(),
      ),
      this.verInactivos.valueChanges.pipe(startWith(this.verInactivos.value)),
    ])
      .pipe(
        tap(() => {
          this.cargando.set(true);
          this.error.set(null);
        }),
        switchMap(([q, inactivos]) =>
          this.api.buscar(q, inactivos).pipe(
            catchError((err) => {
              this.error.set(mensajeError(err));
              return of([]);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((lista) => {
        this.clientes.set(lista);
        this.cargando.set(false);
      });
  }
}
