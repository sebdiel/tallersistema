import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { combineLatest, debounceTime, startWith } from 'rxjs';
import { mensajeError } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { DatosService } from '../../core/datos.service';
import { Repuesto } from '../../core/models';

/** HU-12 / HU-14: inventario de repuestos con alerta de stock bajo. */
@Component({
  selector: 'app-inventario-lista',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Inventario</h1>
        @if (auth.tieneRol('ADMIN')) {
          <a class="btn" routerLink="/inventario/nuevo">+ Nuevo repuesto</a>
        }
      </div>

      <input class="buscador" type="search" placeholder="Buscar por nombre, código o marca…" [formControl]="busqueda" />
      <label style="display: flex; gap: 8px; align-items: center; margin: 12px 0">
        <input type="checkbox" [formControl]="soloBajo" /> Solo stock bajo
      </label>

      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }

      <ul class="lista">
        @for (r of repuestos(); track r.id) {
          <li>
            <a class="item" [routerLink]="['/inventario', r.id]">
              <div>
                <div class="item-titulo">{{ r.nombre }}</div>
                <div class="item-sub">
                  {{ r.codigo }}
                  @if (r.marca) { · {{ r.marca }} }
                  @if (r.ubicacion) { · 📍 {{ r.ubicacion }} }
                </div>
              </div>
              <div style="text-align: right">
                <div [class.stock-bajo]="r.stock <= r.stockMinimo">
                  {{ r.stock | number }} {{ r.unidad.toLowerCase() }}
                </div>
                <div class="item-sub">Bs {{ r.precioVenta | number: '1.2-2' }}</div>
              </div>
            </a>
          </li>
        } @empty {
          <li class="vacio">{{ cargando() ? 'Cargando…' : 'No hay repuestos.' }}</li>
        }
      </ul>
    </div>
  `,
})
export class InventarioListaComponent {
  private readonly datos = inject(DatosService);
  readonly auth = inject(AuthService);

  readonly busqueda = new FormControl('', { nonNullable: true });
  readonly soloBajo = new FormControl(false, { nonNullable: true });
  readonly repuestos = signal<Repuesto[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    combineLatest([
      this.busqueda.valueChanges.pipe(startWith(''), debounceTime(300)),
      this.soloBajo.valueChanges.pipe(startWith(false)),
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(async ([q, bajo]) => {
        try {
          this.error.set(null);
          this.repuestos.set(await this.datos.buscarRepuestos(q, bajo));
        } catch (err) {
          this.error.set(mensajeError(err));
        } finally {
          this.cargando.set(false);
        }
      });
  }
}
