import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../core/auth.interceptor';
import { ConexionService } from '../../core/conexion.service';
import { DatosService } from '../../core/datos.service';
import { Cliente, OrdenTrabajo, Repuesto, Servicio, Vehiculo } from '../../core/models';
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
  imports: [IconoComponent, ReactiveFormsModule, RouterLink, DecimalPipe],
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
          <div class="item resumen-nuevo">
            <div>
              <div class="item-titulo">
                <app-icono nombre="agregar" /> Vehículo nuevo:
                {{ nuevo.value.marca || '—' }} {{ nuevo.value.modelo }} {{ nuevo.value.anio ?? '' }}
              </div>
              <div class="item-sub">
                <app-icono nombre="clientes" />
                {{ clienteNuevo() ? (cliente.value.nombre || 'Cliente nuevo') : (nombreClienteElegido() || 'Sin propietario') }}
              </div>
            </div>
            <div>
              @if (nuevo.value.placa) {
                <span class="placa">{{ nuevo.value.placa }}</span>
              }
              <button type="button" class="btn btn-sec" style="margin-left: 8px" (click)="modalNuevo.set(true)">Editar</button>
            </div>
          </div>
        }
      </section>

      <!-- 2. Recepción -->
      <form class="card" [formGroup]="form" (ngSubmit)="guardar()">
        <h2>2. Recepción</h2>
        <div class="campo">
          <label class="req" for="problema">Motivo de ingreso</label>
          <textarea id="problema" rows="3" formControlName="problemaReportado" placeholder="Ej.: ruido al frenar, cambio de aceite"></textarea>
        </div>

        <!-- RN-33: servicios y repuestos del catálogo como motivo de ingreso -->
        <div class="campo" style="margin-top: 12px">
          <label for="sug">Agregar servicio o repuesto</label>
          <input id="sug" class="buscador" placeholder="Escriba, ej.: cambio, aceite, pastillas…" [value]="busquedaItem()"
            (input)="buscarItem($any($event.target).value)" autocomplete="off" />
          @if (busquedaItem().trim().length >= 2) {
            <div class="sugerencias">
              <div class="sug-cab">Sugerencias</div>
              @for (s of sugServicios(); track s.id) {
                <button type="button" class="sug" (click)="agregarItem('SERVICIO', s.id, s.nombre, s.precio)">
                  <span class="sug-nombre">{{ s.nombre }}</span>
                  <span class="pill servicio">Servicio</span>
                  <span class="pill precio">Bs {{ s.precio | number: '1.2-2' }}</span>
                </button>
              }
              @for (r of sugRepuestos(); track r.id) {
                <button type="button" class="sug" (click)="agregarItem('REPUESTO', r.id, r.nombre, r.precioVenta)">
                  <span class="sug-nombre">{{ r.nombre }} <small>{{ r.codigo }}</small></span>
                  <span class="pill repuesto">Repuesto</span>
                  <span class="pill precio">Bs {{ r.precioVenta | number: '1.2-2' }}</span>
                  <span class="pill" [class.sin-stock]="r.stock <= 0">Stock: {{ r.stock }}</span>
                </button>
              }
              @if (!sugServicios().length && !sugRepuestos().length) {
                <p class="item-sub" style="margin: 8px">No está en Servicios ni en Inventario.</p>
              }
              <div class="sug-nuevo">
                <span>Agregar <strong>«{{ busquedaItem().trim() }}»</strong> como ítem nuevo:</span>
                <button type="button" class="btn btn-sec" (click)="agregarLibre('SERVICIO')">+ Trabajo</button>
                <button type="button" class="btn btn-sec" (click)="agregarLibre('REPUESTO')">+ Repuesto</button>
              </div>
            </div>
          }
          @if (items().length) {
            <ul class="items-elegidos">
              @for (it of items(); track it.id) {
                <li class="item-elegido">
                  <div class="fila-item">
                    <span class="pill" [class.servicio]="it.tipo === 'SERVICIO'" [class.repuesto]="it.tipo === 'REPUESTO'">
                      {{ it.tipo === 'SERVICIO' ? 'Trabajo' : 'Repuesto' }}{{ it.libre ? ' nuevo' : '' }}
                    </span>
                    <span class="sug-nombre">{{ it.nombre }}</span>
                    <strong class="num">Bs {{ it.precio * it.cantidad | number: '1.2-2' }}</strong>
                  </div>
                  <div class="fila-item">
                    <label class="valor-u">Valor/u (Bs)
                      <input type="number" min="0" step="0.5" inputmode="decimal" [value]="it.precio"
                        [disabled]="it.tipo === 'REPUESTO' && !it.libre"
                        [title]="it.tipo === 'REPUESTO' && !it.libre ? 'Precio del inventario' : ''"
                        (input)="cambiarPrecio(it.id, +$any($event.target).value)" />
                    </label>
                    <div class="contador">
                      <button type="button" (click)="cambiarCantidad(it.id, it.cantidad - 1)" [disabled]="it.cantidad <= 1">−</button>
                      <span>{{ it.cantidad }}</span>
                      <button type="button" (click)="cambiarCantidad(it.id, it.cantidad + 1)">+</button>
                    </div>
                    <button type="button" class="quitar" (click)="quitarItem(it.id)" aria-label="Quitar"><app-icono nombre="quitar" /></button>
                  </div>
                </li>
              }
              <li class="total-items">
                <span>Total sugerido</span>
                <strong class="num">Bs {{ totalItems() | number: '1.2-2' }}</strong>
              </li>
            </ul>
          }
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

    @if (modalNuevo()) {
      <div class="modal-velo" (click)="cerrarNuevo()">
        <div class="modal-form" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="modal-form-cab">
            <h2><app-icono nombre="vehiculos" /> Registrar vehículo nuevo</h2>
            <button type="button" class="cerrar" (click)="cerrarNuevo()" aria-label="Cerrar"><app-icono nombre="quitar" /></button>
          </div>
          @if (errorNuevo()) {
            <div class="alerta alerta-error">{{ errorNuevo() }}</div>
          }
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
          <div class="acciones">
            <button type="button" class="btn btn-sec" (click)="cerrarNuevo()">Cancelar</button>
            <button type="button" class="btn" (click)="confirmarNuevo()">Listo</button>
          </div>
        </div>
      </div>
    }

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
    .sugerencias { margin-top: 6px; padding: 6px; border: 1px solid #f5b301; border-radius: 12px; background: var(--superficie);
      max-height: 280px; overflow-y: auto; }
    .sug-cab { padding: 4px 8px; font-size: 0.8rem; color: var(--texto-suave); }
    .sug { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%; margin-top: 6px; padding: 10px 12px;
      border: 1px solid var(--borde); border-radius: 10px; background: transparent; color: var(--texto); font: inherit;
      text-align: left; cursor: pointer; }
    .sug:hover { border-color: #f5b301; background: #f5b30110; }
    .sug-nombre { flex: 1 1 160px; font-weight: 600; }
    .sug-nombre small { color: var(--texto-suave); font-weight: 400; }
    .pill { padding: 2px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: #ffffff14; }
    .pill.precio { background: #16a34a26; color: #4ade80; }
    .pill.servicio { background: #f5b30126; color: #f5b301; }
    .pill.repuesto { background: #3b82f626; color: #60a5fa; }
    .pill.sin-stock { background: #ef444426; color: #f87171; }
    .items-elegidos { list-style: none; margin: 10px 0 0; padding: 0; border: 1px solid var(--borde); border-radius: 12px; }
    .items-elegidos li { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--borde); }
    .items-elegidos li:last-child { border-bottom: none; }
    .items-elegidos li.item-elegido { flex-direction: column; align-items: stretch; gap: 8px; }
    .fila-item { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .valor-u { display: flex; align-items: center; gap: 8px; flex: 1 1 200px; font-size: 0.85rem; color: var(--texto-suave); }
    .valor-u input { flex: 1; min-height: 34px; padding: 2px 8px; }
    .contador { display: inline-flex; align-items: center; border: 1px solid var(--borde); border-radius: 8px; overflow: hidden; }
    .contador button { width: 34px; height: 34px; border: none; background: #f5b301; color: #1a1a1a; font-size: 1.1rem; font-weight: 800; cursor: pointer; }
    .contador button:disabled { opacity: 0.4; cursor: default; }
    .contador span { min-width: 36px; text-align: center; font-weight: 700; }
    .sug-nuevo { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; padding: 10px 12px;
      border-top: 1px dashed var(--borde); }
    .sug-nuevo span { flex: 1 1 200px; }
    .items-elegidos .quitar { display: inline-flex; padding: 4px; border: none; background: transparent; color: var(--texto-suave); cursor: pointer; }
    .items-elegidos .quitar:hover { color: #ef4444; }
    .total-items { justify-content: space-between; background: #f5b30112; }
    .modal-form { width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto; padding: 22px; border-radius: 16px;
      background: var(--superficie); color: var(--texto); border-top: 5px solid #f5b301; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); }
    .modal-form-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .modal-form-cab h2 { margin: 0; display: flex; align-items: center; gap: 8px; }
    .cerrar { display: inline-flex; padding: 6px; border: none; border-radius: 8px; background: transparent;
      color: var(--texto-suave); font-size: 1.2rem; cursor: pointer; }
    .cerrar:hover { color: var(--texto); background: #ffffff12; }
    .resumen-nuevo { box-shadow: none; border: 1px dashed #f5b301; }
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
  /** Ventana emergente para registrar vehículo (y dueño) nuevos. */
  readonly modalNuevo = signal(false);
  readonly errorNuevo = signal<string | null>(null);
  private nuevoConfirmado = false;
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

  // RN-33: servicios y repuestos elegidos como motivo de ingreso
  readonly busquedaItem = signal('');
  readonly sugServicios = signal<Servicio[]>([]);
  readonly sugRepuestos = signal<Repuesto[]>([]);
  /** libre: no está en el catálogo (trabajo → mano de obra; repuesto → repuesto externo del taller). */
  readonly items = signal<
    { tipo: 'SERVICIO' | 'REPUESTO'; id: string; nombre: string; precio: number; cantidad: number; libre?: boolean }[]
  >([]);
  readonly totalItems = computed(() => this.items().reduce((s, it) => s + it.precio * it.cantidad, 0));
  private servicios: Servicio[] = [];

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
    this.datos.servicios().then((s) => (this.servicios = s.filter((x) => x.activo !== false))).catch(() => {});
    // ?placa=XXX preselecciona el vehículo (enlace desde la ficha del vehículo).
    const lista = await this.datos.buscarVehiculos(this.placa() ?? '');
    this.vehiculos.set(lista);
    const v = this.placa() ? lista.find((x) => x.placa === this.placa()) : undefined;
    if (v) this.elegirVehiculo(v);
  }

  async buscarItem(q: string) {
    this.busquedaItem.set(q);
    const t = q.trim().toLowerCase();
    if (t.length < 2) return;
    this.sugServicios.set(this.servicios.filter((s) => s.nombre.toLowerCase().includes(t)).slice(0, 6));
    try {
      this.sugRepuestos.set((await this.datos.buscarRepuestos(q.trim())).slice(0, 6));
    } catch {
      this.sugRepuestos.set([]);
    }
  }

  agregarItem(tipo: 'SERVICIO' | 'REPUESTO', id: string, nombre: string, precio: number) {
    const ya = this.items().find((it) => it.id === id);
    if (ya) this.cambiarCantidad(id, ya.cantidad + 1);
    else this.items.update((l) => [...l, { tipo, id, nombre, precio, cantidad: 1 }]);
    this.busquedaItem.set('');
    this.actualizarCosto();
  }

  agregarLibre(tipo: 'SERVICIO' | 'REPUESTO') {
    const nombre = this.busquedaItem().trim();
    if (nombre.length < 3) return this.error.set('Escriba el nombre del ítem (mínimo 3 letras)');
    this.items.update((l) => [...l, { tipo, id: crypto.randomUUID(), nombre, precio: 0, cantidad: 1, libre: true }]);
    this.busquedaItem.set('');
    this.actualizarCosto();
  }

  cambiarPrecio(id: string, precio: number) {
    if (!(precio >= 0)) return;
    this.items.update((l) => l.map((it) => (it.id === id ? { ...it, precio } : it)));
    this.actualizarCosto();
  }

  cambiarCantidad(id: string, cantidad: number) {
    if (!(cantidad > 0)) return;
    this.items.update((l) => l.map((it) => (it.id === id ? { ...it, cantidad } : it)));
    this.actualizarCosto();
  }

  quitarItem(id: string) {
    this.items.update((l) => l.filter((it) => it.id !== id));
    this.actualizarCosto();
  }

  /** El costo estimado se llena con la suma de lo elegido (se puede corregir a mano). */
  private actualizarCosto() {
    this.form.controls.costoEstimado.setValue(this.items().length ? Math.round(this.totalItems() * 100) / 100 : null);
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
    this.errorNuevo.set(null);
    this.modalNuevo.set(true);
    this.clientes.set(await this.datos.buscarClientes(''));
  }

  /** Valida el vehículo y el dueño antes de cerrar la ventana. */
  confirmarNuevo() {
    this.nuevo.markAllAsTouched();
    if (this.nuevo.invalid) return this.errorNuevo.set('Complete placa, marca y modelo');
    if (this.clienteNuevo()) {
      this.cliente.markAllAsTouched();
      if (this.cliente.invalid) return this.errorNuevo.set('Complete nombre y teléfono del cliente');
    } else if (!this.clienteId.value) {
      return this.errorNuevo.set('Seleccione el propietario');
    }
    this.errorNuevo.set(null);
    this.nuevoConfirmado = true;
    this.modalNuevo.set(false);
  }

  /** Cerrar sin confirmar la primera vez vuelve a "Ya registrado". */
  cerrarNuevo() {
    this.modalNuevo.set(false);
    if (!this.nuevoConfirmado) this.modo.set('existente');
  }

  nombreClienteElegido() {
    return this.clientes().find((c) => c.id === this.clienteId.value)?.nombre ?? '';
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
        repuestosSugeridos: this.items()
          .filter((it) => it.tipo === 'REPUESTO' && !it.libre)
          .map((it) => ({ repuestoId: it.id, nombre: it.nombre, cantidad: it.cantidad })),
      });
      // RN-33: los trabajos quedan como mano de obra y los repuestos nuevos como repuestos externos del taller.
      let actual = orden;
      for (const it of this.items().filter((x) => x.tipo === 'SERVICIO' || x.libre)) {
        if (it.tipo === 'SERVICIO') {
          await this.datos.agregarManoObra(actual, {
            servicioId: it.libre ? null : it.id,
            descripcion: it.cantidad > 1 ? `${it.nombre} (x${it.cantidad})` : it.nombre,
            monto: it.precio * it.cantidad,
          });
        } else {
          await this.datos.agregarRepuestoExterno(actual, {
            descripcion: it.nombre,
            cantidad: it.cantidad,
            origen: 'TALLER',
            precioUnitario: it.precio,
          });
        }
        actual = await this.datos.obtenerOrden(orden.id);
      }
      this.router.navigate(['/ordenes', orden.id]);
    } catch (err) {
      this.error.set(mensajeError(err));
      this.guardando.set(false);
    }
  }
}
