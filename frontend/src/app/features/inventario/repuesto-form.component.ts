import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RepuestosApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { UNIDADES } from '../../core/models';

/** HU-12: registrar / editar repuesto (solo administrador, requiere conexión). */
@Component({
  selector: 'app-repuesto-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>{{ id() ? 'Editar repuesto' : 'Nuevo repuesto' }}</h1>
      </div>

      <form class="card" [formGroup]="form" (ngSubmit)="guardar()">
        @if (error()) {
          <div class="alerta alerta-error">{{ error() }}</div>
        }
        <div class="grid-2">
          <div class="campo">
            <label class="req" for="codigo">Código</label>
            <input id="codigo" formControlName="codigo" autocapitalize="characters" placeholder="FIL-001" />
          </div>
          <div class="campo">
            <label class="req" for="nombre">Nombre</label>
            <input id="nombre" formControlName="nombre" placeholder="Filtro de aceite" />
          </div>
          <div class="campo">
            <label for="marca">Marca</label>
            <input id="marca" formControlName="marca" />
          </div>
          <div class="campo">
            <label for="unidad">Unidad</label>
            <select id="unidad" formControlName="unidad">
              @for (u of unidades; track u) {
                <option [value]="u">{{ u }}</option>
              }
            </select>
          </div>
          @if (!id()) {
            <div class="campo">
              <label for="stock">Stock inicial</label>
              <input id="stock" type="number" inputmode="decimal" min="0" formControlName="stock" />
            </div>
          }
          <div class="campo">
            <label for="min">Stock mínimo (alerta)</label>
            <input id="min" type="number" inputmode="decimal" min="0" formControlName="stockMinimo" />
          </div>
          <div class="campo">
            <label for="pc">Precio de compra (Bs)</label>
            <input id="pc" type="number" inputmode="decimal" min="0" step="0.01" formControlName="precioCompra" />
          </div>
          <div class="campo">
            <label for="pv">Precio de venta (Bs)</label>
            <input id="pv" type="number" inputmode="decimal" min="0" step="0.01" formControlName="precioVenta" />
          </div>
          <div class="campo">
            <label for="ubi">Ubicación</label>
            <input id="ubi" formControlName="ubicacion" placeholder="Estante A2" />
          </div>
        </div>
        <div class="acciones">
          <a class="btn btn-sec" [routerLink]="id() ? ['/inventario', id()] : ['/inventario']">Cancelar</a>
          <button class="btn" type="submit" [disabled]="form.invalid || guardando()">
            {{ guardando() ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class RepuestoFormComponent implements OnInit {
  private readonly api = inject(RepuestosApi);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly unidades = UNIDADES;
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    codigo: ['', [Validators.required, Validators.pattern(/^[0-9A-Za-z._-]{2,30}$/)]],
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    marca: [''],
    unidad: ['UNIDAD'],
    stock: [0, Validators.min(0)],
    stockMinimo: [0, Validators.min(0)],
    precioCompra: [0, Validators.min(0)],
    precioVenta: [0, Validators.min(0)],
    ubicacion: [''],
  });

  ngOnInit() {
    const id = this.id();
    if (!id) return;
    this.api.detalle(id).subscribe({
      next: ({ repuesto: r }) =>
        this.form.patchValue({ ...r, marca: r.marca ?? '', ubicacion: r.ubicacion ?? '' }),
      error: (err) => this.error.set(mensajeError(err)),
    });
  }

  guardar() {
    this.guardando.set(true);
    this.error.set(null);
    const { stock, ...datos } = this.form.getRawValue();
    const id = this.id();
    const peticion = id ? this.api.actualizar(id, datos) : this.api.crear({ ...datos, stock });
    peticion.subscribe({
      next: (r) => this.router.navigate(['/inventario', r.id]),
      error: (err) => {
        this.error.set(mensajeError(err));
        this.guardando.set(false);
      },
    });
  }
}
