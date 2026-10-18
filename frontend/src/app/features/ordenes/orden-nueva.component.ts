import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../core/auth.interceptor';
import { ConexionService } from '../../core/conexion.service';
import { DatosService } from '../../core/datos.service';
import { Cliente, Persona, Vehiculo } from '../../core/models';

type Modo = 'existente' | 'nuevo';

/** HU-09: recepción del vehículo y apertura de la orden de trabajo. */
@Component({
  selector: 'app-orden-nueva',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <div>
          <a routerLink="/ordenes">← Órdenes</a>
          <h1>Recibir vehículo</h1>
        </div>
      </div>

      @if (!conexion.enLinea()) {
        <div class="alerta alerta-warn">
          Sin conexión: la orden se guardará en este dispositivo y se enviará al servidor cuando vuelva internet.
        </div>
      }
      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }

      <!-- 1. Vehículo -->
      <section class="card">
        <h2>1. Vehículo</h2>
        <div class="filtros" style="margin-top: 0">
          <button type="button" [class.activo]="modo() === 'existente'" (click)="modo.set('existente')">
            Ya registrado
          </button>
          <button type="button" [class.activo]="modo() === 'nuevo'" (click)="cambiarANuevo()">
            Vehículo nuevo
          </button>
        </div>

        @if (modo() === 'existente') {
          @if (vehiculo(); as v) {
            <div class="item" style="box-shadow: none; border: 1px solid var(--borde)">
              <div>
                <div class="item-titulo">{{ v.marca }} {{ v.modelo }} {{ v.anio ?? '' }}</div>
                <div class="item-sub">👤 {{ v.cliente?.nombre }} · último km: {{ v.kilometraje }}</div>
              </div>
              <div>
                <span class="placa">{{ v.placa }}</span>
                <button type="button" class="btn btn-sec" style="margin-left: 8px" (click)="vehiculo.set(null)">
                  Cambiar
                </button>
              </div>
            </div>
          } @else {
            <input
              class="buscador"
              placeholder="Escriba la placa…"
              autocapitalize="characters"
              (input)="buscarVehiculo($any($event.target).value)"
            />
            <ul class="lista" style="margin-top: 8px">
              @for (v of vehiculos(); track v.id) {
                <li>
                  <button type="button" class="item" style="width: 100%; border: none; font: inherit; cursor: pointer; text-align: left" (click)="elegirVehiculo(v)">
                    <div>
                      <div class="item-titulo">{{ v.marca }} {{ v.modelo }}</div>
                      <div class="item-sub">👤 {{ v.cliente?.nombre }}</div>
                    </div>
                    <span class="placa">{{ v.placa }}</span>
                  </button>
                </li>
              } @empty {
                <li class="vacio">Sin resultados. ¿Es un vehículo nuevo? Use la pestaña "Vehículo nuevo".</li>
              }
            </ul>
          }
        } @else {
          <form [formGroup]="nuevo" class="grid-2">
            <div class="campo">
              <label class="req" for="placa">Placa</label>
              <input id="placa" formControlName="placa" autocapitalize="characters" placeholder="2345ABC" />
            </div>
            <div class="campo">
              <label for="anio">Año</label>
              <input id="anio" type="number" inputmode="numeric" formControlName="anio" />
            </div>
            <div class="campo">
              <label class="req" for="marca">Marca</label>
              <input id="marca" formControlName="marca" />
            </div>
            <div class="campo">
              <label class="req" for="modelo">Modelo</label>
              <input id="modelo" formControlName="modelo" />
            </div>
          </form>

          <h2 style="margin-top: 16px">Propietario</h2>
          <div class="filtros" style="margin-top: 0">
            <button type="button" [class.activo]="!clienteNuevo()" (click)="clienteNuevo.set(false)">Cliente registrado</button>
            <button type="button" [class.activo]="clienteNuevo()" (click)="clienteNuevo.set(true)">Cliente nuevo</button>
          </div>
          @if (clienteNuevo()) {
            <form [formGroup]="cliente" class="grid-2">
              <div class="campo">
                <label class="req" for="cnombre">Nombre</label>
                <input id="cnombre" formControlName="nombre" />
              </div>
              <div class="campo">
                <label class="req" for="ctel">Teléfono</label>
                <input id="ctel" type="tel" inputmode="tel" formControlName="telefono" />
              </div>
              <div class="campo">
                <label for="cci">CI / NIT</label>
                <input id="cci" formControlName="ciNit" />
              </div>
            </form>
          } @else {
            <div class="campo">
              <input class="buscador" placeholder="Filtrar por nombre o teléfono…" (input)="buscarCliente($any($event.target).value)" />
              <select [formControl]="clienteId" style="margin-top: 6px">
                <option value="">Seleccione…</option>
                @for (c of clientes(); track c.id) {
                  <option [value]="c.id">{{ c.nombre }} — {{ c.telefono }}</option>
                }
              </select>
            </div>
          }
        }
      </section>

      <!-- 2. Recepción -->
      <form class="card" [formGroup]="form" (ngSubmit)="guardar()">
        <h2>2. Recepción</h2>
        <div class="campo">
          <label class="req" for="problema">Problema reportado por el cliente</label>
          <textarea id="problema" rows="3" formControlName="problemaReportado" placeholder="Ej.: ruido al frenar, revisar aceite"></textarea>
        </div>
        <div class="grid-2" style="margin-top: 12px">
          <div class="campo">
            <label class="req" for="km">Kilometraje de ingreso</label>
            <input id="km" type="number" inputmode="numeric" min="0" formControlName="kilometrajeIngreso" />
          </div>
          <div class="campo">
            <label for="mec">Mecánico asignado</label>
            <select id="mec" formControlName="mecanicoId">
              <option value="">Sin asignar</option>
              @for (p of personal(); track p.id) {
                <option [value]="p.id">{{ p.nombre }}</option>
              }
            </select>
          </div>
        </div>
        <div class="campo" style="margin-top: 12px">
          <label for="obs">Estado del vehículo al ingresar</label>
          <textarea id="obs" rows="2" formControlName="observacionesRecepcion" placeholder="Rayones, objetos dejados, nivel de combustible…"></textarea>
        </div>

        <div class="acciones">
          <a class="btn btn-sec" routerLink="/ordenes">Cancelar</a>
          <button class="btn" type="submit" [disabled]="guardando()">
            {{ guardando() ? 'Guardando…' : 'Abrir orden de trabajo' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class OrdenNuevaComponent implements OnInit {
  private readonly datos = inject(DatosService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly conexion = inject(ConexionService);

  /** Query param opcional para preseleccionar el vehículo. */
  readonly placa = input<string>();

  readonly modo = signal<Modo>('existente');
  readonly clienteNuevo = signal(false);
  readonly vehiculo = signal<Vehiculo | null>(null);
  readonly vehiculos = signal<Vehiculo[]>([]);
  readonly clientes = signal<Cliente[]>([]);
  readonly personal = signal<Persona[]>([]);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  readonly clienteId = this.fb.nonNullable.control('');

  readonly nuevo = this.fb.nonNullable.group({
    placa: ['', [Validators.required, Validators.pattern(/^[0-9A-Za-z\s-]{5,12}$/)]],
    marca: ['', Validators.required],
    modelo: ['', Validators.required],
    anio: [null as number | null],
  });

  readonly cliente = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    telefono: ['', [Validators.required, Validators.pattern(/^[0-9+\s-]{7,20}$/)]],
    ciNit: [''],
  });

  readonly form = this.fb.nonNullable.group({
    problemaReportado: ['', [Validators.required, Validators.minLength(5)]],
    kilometrajeIngreso: [0, [Validators.required, Validators.min(0)]],
    mecanicoId: [''],
    observacionesRecepcion: [''],
  });

  async ngOnInit() {
    this.personal.set(await this.datos.personal());
    // ?placa=XXX preselecciona el vehículo (enlace desde la ficha del vehículo).
    const lista = await this.datos.buscarVehiculos(this.placa() ?? '');
    this.vehiculos.set(lista);
    const v = this.placa() ? lista.find((x) => x.placa === this.placa()) : undefined;
    if (v) this.elegirVehiculo(v);
  }

  async buscarVehiculo(q: string) {
    try {
      this.vehiculos.set(await this.datos.buscarVehiculos(q));
    } catch (err) {
      this.error.set(mensajeError(err));
    }
  }

  async buscarCliente(q: string) {
    this.clientes.set(await this.datos.buscarClientes(q));
  }

  elegirVehiculo(v: Vehiculo) {
    this.vehiculo.set(v);
    this.form.controls.kilometrajeIngreso.setValue(v.kilometraje);
  }

  async cambiarANuevo() {
    this.modo.set('nuevo');
    this.clientes.set(await this.datos.buscarClientes(''));
  }

  async guardar() {
    this.error.set(null);
    const esNuevo = this.modo() === 'nuevo';

    if (!esNuevo && !this.vehiculo()) return this.error.set('Seleccione el vehículo');
    if (esNuevo) {
      this.nuevo.markAllAsTouched();
      if (this.nuevo.invalid) return this.error.set('Complete los datos del vehículo nuevo');
      if (this.clienteNuevo()) {
        this.cliente.markAllAsTouched();
        if (this.cliente.invalid) return this.error.set('Complete nombre y teléfono del cliente');
      } else if (!this.clienteId.value) {
        return this.error.set('Seleccione el propietario');
      }
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) return this.error.set('Describa el problema y el kilometraje');

    this.guardando.set(true);
    const f = this.form.getRawValue();
    try {
      const orden = await this.datos.crearOrden({
        vehiculoId: esNuevo ? undefined : this.vehiculo()!.id,
        nuevoVehiculo: esNuevo
          ? { ...this.nuevo.getRawValue(), clienteId: this.clienteNuevo() ? undefined : this.clienteId.value }
          : undefined,
        nuevoCliente: esNuevo && this.clienteNuevo() ? this.cliente.getRawValue() : undefined,
        problemaReportado: f.problemaReportado,
        kilometrajeIngreso: Number(f.kilometrajeIngreso),
        observacionesRecepcion: f.observacionesRecepcion,
        mecanicoId: f.mecanicoId || null,
      });
      this.router.navigate(['/ordenes', orden.id]);
    } catch (err) {
      this.error.set(mensajeError(err));
      this.guardando.set(false);
    }
  }
}
