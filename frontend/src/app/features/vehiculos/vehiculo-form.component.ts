import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClientesApi, VehiculosApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { COMBUSTIBLES, Cliente } from '../../core/models';

const ANIO_MAX = new Date().getFullYear() + 1;

/** RN-01: misma normalización de placa que el backend. */
const normalizarPlaca = (p: string) => p.toUpperCase().replace(/[\s-]/g, '');

/** HU-06: registrar / editar la ficha técnica de un vehículo. */
@Component({
  selector: 'app-vehiculo-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>{{ id() ? 'Editar vehículo' : 'Nuevo vehículo' }}</h1>
      </div>

      <form class="card" [formGroup]="form" (ngSubmit)="guardar()">
        @if (error()) {
          <div class="alerta alerta-error">{{ error() }}</div>
        }

        <div class="campo" [class.invalido]="invalido('clienteId')" style="margin-bottom: 12px">
          <label for="clienteId" class="req">Propietario</label>
          @if (!clienteId() || id()) {
            <input
              class="buscador"
              placeholder="Filtrar clientes por nombre o teléfono…"
              (input)="filtrarClientes($any($event.target).value)"
              style="margin-bottom: 6px"
            />
          }
          <select id="clienteId" formControlName="clienteId">
            <option value="" disabled>Seleccione un cliente…</option>
            @for (c of clientes(); track c.id) {
              <option [value]="c.id">{{ c.nombre }} — {{ c.telefono }}</option>
            }
          </select>
          @if (invalido('clienteId')) {
            <span class="error-campo">Seleccione el propietario</span>
          }
          <small>
            ¿No está en la lista? <a routerLink="/clientes/nuevo">Registrar cliente</a>
          </small>
        </div>

        <div class="grid-2">
          <div class="campo" [class.invalido]="invalido('placa')">
            <label for="placa" class="req">Placa</label>
            <input
              id="placa"
              formControlName="placa"
              placeholder="2345ABC"
              autocapitalize="characters"
              (blur)="normalizar()"
            />
            @if (invalido('placa')) {
              <span class="error-campo">Placa inválida (5 a 10 letras/números)</span>
            }
          </div>

          <div class="campo" [class.invalido]="invalido('kilometraje')">
            <label for="kilometraje">Kilometraje actual</label>
            <input id="kilometraje" type="number" inputmode="numeric" min="0" formControlName="kilometraje" />
            @if (invalido('kilometraje')) {
              <span class="error-campo">Debe ser un número positivo</span>
            }
          </div>

          <div class="campo" [class.invalido]="invalido('marca')">
            <label for="marca" class="req">Marca</label>
            <input id="marca" formControlName="marca" placeholder="Toyota" />
          </div>

          <div class="campo" [class.invalido]="invalido('modelo')">
            <label for="modelo" class="req">Modelo</label>
            <input id="modelo" formControlName="modelo" placeholder="Corolla" />
          </div>

          <div class="campo" [class.invalido]="invalido('anio')">
            <label for="anio">Año</label>
            <input id="anio" type="number" inputmode="numeric" formControlName="anio" />
            @if (invalido('anio')) {
              <span class="error-campo">Entre 1950 y {{ anioMax }}</span>
            }
          </div>

          <div class="campo">
            <label for="color">Color</label>
            <input id="color" formControlName="color" />
          </div>

          <div class="campo">
            <label for="combustible">Combustible</label>
            <select id="combustible" formControlName="combustible">
              <option value="">—</option>
              @for (c of combustibles; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
          </div>

          <div class="campo">
            <label for="nroChasis">N.º de chasis (VIN)</label>
            <input id="nroChasis" formControlName="nroChasis" />
          </div>
        </div>

        <div class="campo" style="margin-top: 12px">
          <label for="observaciones">Observaciones</label>
          <textarea id="observaciones" rows="3" formControlName="observaciones"></textarea>
        </div>

        <div class="acciones">
          <a class="btn btn-sec" [routerLink]="id() ? ['/vehiculos', id()] : ['/vehiculos']">Cancelar</a>
          <button class="btn" type="submit" [disabled]="guardando()">
            {{ guardando() ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class VehiculoFormComponent implements OnInit {
  private readonly api = inject(VehiculosApi);
  private readonly clientesApi = inject(ClientesApi);
  private readonly router = inject(Router);

  /** Parámetro de ruta (al editar). */
  readonly id = input<string>();
  /** Query param opcional: preselecciona el propietario. */
  readonly clienteId = input<string>();

  readonly anioMax = ANIO_MAX;
  readonly combustibles = COMBUSTIBLES;
  readonly clientes = signal<Cliente[]>([]);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(FormBuilder).group({
    clienteId: ['', Validators.required],
    placa: ['', [Validators.required, Validators.pattern(/^[0-9A-Za-z\s-]{5,12}$/)]],
    marca: ['', [Validators.required, Validators.maxLength(50)]],
    modelo: ['', [Validators.required, Validators.maxLength(50)]],
    anio: [null as number | null, [Validators.min(1950), Validators.max(ANIO_MAX)]],
    color: [''],
    combustible: [''],
    nroChasis: [''],
    kilometraje: [0 as number | null, Validators.min(0)],
    observaciones: [''],
  });

  ngOnInit() {
    const id = this.id();
    if (id) {
      this.api.ficha(id).subscribe({
        next: ({ vehiculo: v }) => {
          if (v.cliente) this.clientes.set([v.cliente]);
          this.form.patchValue({
            clienteId: v.clienteId,
            placa: v.placa,
            marca: v.marca,
            modelo: v.modelo,
            anio: v.anio,
            color: v.color ?? '',
            combustible: v.combustible ?? '',
            nroChasis: v.nroChasis ?? '',
            kilometraje: v.kilometraje,
            observaciones: v.observaciones ?? '',
          });
        },
        error: (err) => this.error.set(mensajeError(err)),
      });
      return;
    }

    const clienteId = this.clienteId();
    if (clienteId) {
      this.clientesApi.obtener(clienteId).subscribe((c) => {
        this.clientes.set([c]);
        this.form.patchValue({ clienteId: c.id });
      });
    } else {
      this.filtrarClientes('');
    }
  }

  filtrarClientes(q: string) {
    this.clientesApi.buscar(q).subscribe((lista) => {
      // Mantener visible al cliente ya seleccionado aunque no coincida con el filtro.
      const actual = this.clientes().find((c) => c.id === this.form.value.clienteId);
      this.clientes.set(actual && !lista.some((c) => c.id === actual.id) ? [actual, ...lista] : lista);
    });
  }

  normalizar() {
    const placa = this.form.controls.placa.value;
    if (placa) this.form.controls.placa.setValue(normalizarPlaca(placa));
  }

  invalido(campo: keyof typeof this.form.controls) {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  guardar() {
    this.normalizar();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    const datos = {
      ...v,
      clienteId: v.clienteId!,
      placa: v.placa!,
      marca: v.marca!,
      modelo: v.modelo!,
      anio: v.anio || null,
      kilometraje: v.kilometraje ?? 0,
      combustible: v.combustible || null,
    };

    const id = this.id();
    const peticion = id ? this.api.actualizar(id, datos) : this.api.crear(datos);
    peticion.subscribe({
      next: (veh) => this.router.navigate(['/vehiculos', veh.id]),
      error: (err) => {
        this.error.set(mensajeError(err));
        this.guardando.set(false);
      },
    });
  }
}
