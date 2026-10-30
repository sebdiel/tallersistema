import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../core/auth.interceptor';
import { ConexionService } from '../../core/conexion.service';
import { DatosService } from '../../core/datos.service';
import { Cliente, OrdenTrabajo, Vehiculo } from '../../core/models';
import { IconoComponent } from '../../layout/icono.component';

type Modo = 'existente' | 'nuevo';

interface DiaAgenda {
  fecha: string;
  num: number;
  semana: string;
  mes: string;
  ordenes: OrdenTrabajo[];
}

const aIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoyLocal = () => aIso(new Date());

/** HU-09: recepción del vehículo y apertura de la orden de trabajo. */
@Component({
  selector: 'app-orden-nueva',
  standalone: true,
  imports: [IconoComponent, ReactiveFormsModule, RouterLink],
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
                <div class="item-sub"><app-icono nombre="clientes" /> {{ v.cliente?.nombre }} · último km: {{ v.kilometraje }}</div>
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
                      <div class="item-sub"><app-icono nombre="clientes" /> {{ v.cliente?.nombre }}</div>
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
          <!-- RN-27: lo que se le dijo al cliente "más o menos" -->
          <div class="campo">
            <label for="costo">Costo estimado (Bs)</label>
            <input id="costo" type="number" inputmode="decimal" min="0" step="0.01" formControlName="costoEstimado" placeholder="Opcional, ej.: 500" />
          </div>
        </div>
        <!-- RN-26: fecha de entrega acordada con el cliente -->
        <div class="campo" style="margin-top: 12px">
          <label>¿Para cuándo lo necesita el cliente?</label>
          <div class="calendario">
            @for (d of dias(); track d.fecha) {
              <button type="button" class="dia" [class.elegido]="entrega() === d.fecha"
                [class.ocupado]="d.ordenes.length > 0" (click)="elegirDia(d)">
                <span class="dsem">{{ d.semana }}</span>
                <strong>{{ d.num }}</strong>
                <span class="dmes">{{ d.mes }}</span>
                <span class="destado">{{ d.ordenes.length ? d.ordenes.length + ' por entregar' : 'Libre' }}</span>
              </button>
            }
          </div>
          <div class="fila-fecha">
            <span class="item-sub">Otra fecha:</span>
            <input type="date" [min]="hoy" [value]="entrega() ?? ''" (change)="elegirFecha($any($event.target).value)" />
            @if (entrega()) {
              <span class="etiqueta-entrega">Entrega: {{ formatear(entrega()!) }}</span>
              <button type="button" class="btn btn-sec" style="min-height: 32px" (click)="entrega.set(null)">Quitar</button>
            }
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

    @if (confirmar(); as c) {
      <div class="modal-velo">
        <div class="modal-aviso" role="alertdialog" aria-modal="true">
          <div class="modal-icono"><app-icono nombre="alerta" /></div>
          <h2>Ese día ya tiene {{ c.ordenes.length }} vehículo(s) por entregar</h2>
          <p>{{ formatear(c.fecha) }}</p>
          <ul class="lista-ocupados">
            @for (o of c.ordenes; track o.id) {
              <li><span class="placa">{{ o.vehiculo?.placa }}</span> {{ o.vehiculo?.marca }} {{ o.vehiculo?.modelo }} · {{ o.cliente?.nombre }}</li>
            }
          </ul>
          <p class="modal-nota">¿Puede entregar también este vehículo ese día?</p>
          <button type="button" class="modal-boton" (click)="aceptarDia()">Sí, acepto esa fecha</button>
          <button type="button" class="btn btn-sec" style="width: 100%; margin-top: 8px" (click)="confirmar.set(null)">Elegir otro día</button>
        </div>
      </div>
    }
  `,
  styles: `
    .calendario { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; }
    .dia { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; border-radius: 10px;
      border: 1px solid var(--borde); background: var(--superficie); color: var(--texto); font: inherit; cursor: pointer; }
    .dia strong { font-size: 1.3rem; }
    .dsem, .dmes { font-size: 0.72rem; text-transform: uppercase; color: var(--texto-suave); }
    .destado { font-size: 0.7rem; color: #16a34a; font-weight: 600; }
    .dia.ocupado { border-color: #d97706; }
    .dia.ocupado .destado { color: #d97706; }
    .dia.elegido { background: #f5b301; border-color: #f5b301; color: #1a1a1a; }
    .dia.elegido .dsem, .dia.elegido .dmes, .dia.elegido .destado { color: #1a1a1a; }
    .fila-fecha { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
    .fila-fecha input { width: auto; }
    .etiqueta-entrega { padding: 4px 10px; border-radius: 999px; background: #f5b30122; font-weight: 600; font-size: 0.85rem; }
    .modal-velo { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
      padding: 16px; background: rgba(0, 0, 0, 0.6); }
    .modal-aviso { width: 100%; max-width: 420px; padding: 24px; border-radius: 16px; background: var(--superficie);
      color: var(--texto); text-align: center; border-top: 5px solid #f5b301; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45); }
    .modal-icono { font-size: 2.4rem; color: #f5b301; }
    .modal-aviso h2 { margin: 6px 0; font-size: 1.1rem; }
    .modal-nota { color: var(--texto-suave); font-size: 0.9rem; }
    .modal-boton { width: 100%; margin-top: 10px; padding: 12px; border: none; border-radius: 10px; background: #f5b301;
      color: #1a1a1a; font-weight: 700; font-size: 1rem; cursor: pointer; }
    .lista-ocupados { list-style: none; padding: 0; margin: 10px 0; text-align: left; font-size: 0.9rem; }
    .lista-ocupados li { padding: 6px 0; border-bottom: 1px solid var(--borde); }
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
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  // RN-26: agenda de entregas
  readonly hoy = hoyLocal();
  readonly entrega = signal<string | null>(null);
  readonly agenda = signal<Record<string, OrdenTrabajo[]>>({});
  readonly confirmar = signal<DiaAgenda | null>(null);
  readonly dias = computed<DiaAgenda[]>(() => {
    const ag = this.agenda();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const fecha = aIso(d);
      return {
        fecha,
        num: d.getDate(),
        semana: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : d.toLocaleDateString('es-BO', { weekday: 'short' }),
        mes: d.toLocaleDateString('es-BO', { month: 'short' }),
        ordenes: ag[fecha] ?? [],
      };
    });
  });

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
    observacionesRecepcion: [''],
    costoEstimado: [null as number | null, Validators.min(0)],
  });

  async ngOnInit() {
    this.datos.agendaEntregas().then((a) => this.agenda.set(a)).catch(() => {});
    // ?placa=XXX preselecciona el vehículo (enlace desde la ficha del vehículo).
    const lista = await this.datos.buscarVehiculos(this.placa() ?? '');
    this.vehiculos.set(lista);
    const v = this.placa() ? lista.find((x) => x.placa === this.placa()) : undefined;
    if (v) this.elegirVehiculo(v);
  }

  elegirDia(d: DiaAgenda) {
    if (d.ordenes.length) this.confirmar.set(d);
    else this.entrega.set(d.fecha);
  }

  elegirFecha(fecha: string) {
    if (!fecha) return this.entrega.set(null);
    if (fecha < this.hoy) return this.error.set('La fecha de entrega no puede ser anterior a hoy');
    this.elegirDia({ fecha, num: 0, semana: '', mes: '', ordenes: this.agenda()[fecha] ?? [] });
  }

  aceptarDia() {
    this.entrega.set(this.confirmar()!.fecha);
    this.confirmar.set(null);
  }

  formatear(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });
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
    if (this.form.invalid) return this.error.set('Revise el problema, el kilometraje y el costo estimado');

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
        fechaEntregaEstimada: this.entrega(),
        costoEstimado: f.costoEstimado != null && String(f.costoEstimado) !== '' ? Number(f.costoEstimado) : null,
      });
      this.router.navigate(['/ordenes', orden.id]);
    } catch (err) {
      this.error.set(mensajeError(err));
      this.guardando.set(false);
    }
  }
}
