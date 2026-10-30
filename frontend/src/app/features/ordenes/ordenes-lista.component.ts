import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { mensajeError } from '../../core/auth.interceptor';
import { DatosService } from '../../core/datos.service';
import { ESTADOS_ABIERTOS, ESTADO_INFO } from '../../core/estados';
import { calcularTotales } from '../../core/costos';
import { EstadoOrden, OrdenTrabajo, formatoNumero } from '../../core/models';
import { SyncService } from '../../core/sync.service';
import { IconoComponent } from '../../layout/icono.component';

type Filtro = 'ABIERTAS' | 'TODAS' | EstadoOrden;

const FILTROS: { valor: Filtro; texto: string; icono: string }[] = [
  { valor: 'ABIERTAS', texto: 'En el taller', icono: 'taller' },
  { valor: 'RECIBIDO', texto: 'Recepción', icono: 'recibir' },
  { valor: 'EN_DIAGNOSTICO', texto: 'Diagnóstico', icono: 'diagnostico' },
  { valor: 'EN_REPARACION', texto: 'Reparación', icono: 'llave' },
  { valor: 'TERMINADO', texto: 'Listos', icono: 'ok' },
  { valor: 'ENTREGADO', texto: 'Entregados', icono: 'entregado' },
  { valor: 'TODAS', texto: 'Todas', icono: 'carpeta' },
];

/** HU-10: tablero de órdenes de trabajo por estado. */
@Component({
  selector: 'app-ordenes-lista',
  standalone: true,
  imports: [IconoComponent, ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Órdenes de trabajo</h1>
        <a class="btn" routerLink="/ordenes/nueva">+ Recibir vehículo</a>
      </div>

      <input
        class="buscador"
        type="search"
        placeholder="Buscar por placa, cliente o N.º de OT…"
        [formControl]="busqueda"
      />

      <nav class="pestanas">
        @for (f of filtros; track f.valor) {
          <button type="button" class="pestana" [class.activa]="filtro() === f.valor" (click)="filtro.set(f.valor)">
            <app-icono [nombre]="f.icono" />
            <span>{{ f.texto }}</span>
            @if (conteo(f.valor) !== null) {
              <span class="cuenta">{{ conteo(f.valor) }}</span>
            }
          </button>
        }
      </nav>

      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }

      <ul class="fichas">
        @if (cargando()) {
          <li class="vacio">Cargando…</li>
        } @else {
          @for (o of ordenes(); track o.id) {
            <li class="ficha">
              <div class="ficha-cab">
                <strong class="ficha-num">{{ numero(o.numero) }}</strong>
                <span [class]="'estado-ot ' + info[o.estado].clase">{{ info[o.estado].texto }}</span>
                @if (atrasada(o)) {
                  <span class="etq-roja">Entrega atrasada</span>
                }
                @if (o._pendiente) {
                  <span class="pendiente-sync">⟳ sin sincronizar</span>
                }
              </div>

              <div class="ficha-cuerpo">
                <dl class="ficha-datos">
                  <dt>Fecha</dt>
                  <dd>{{ o.fechaIngreso | date: 'dd/MM/yyyy HH:mm' }}</dd>
                  <dt>Cliente</dt>
                  <dd>
                    {{ o.cliente?.nombre }}
                    @if (o.cliente?.telefono) {
                      · <a [href]="'tel:' + o.cliente?.telefono">{{ o.cliente?.telefono }}</a>
                    }
                  </dd>
                  <dt>Vehículo</dt>
                  <dd>
                    {{ o.vehiculo?.marca }} {{ o.vehiculo?.modelo }} {{ o.vehiculo?.anio ?? '' }} ·
                    <span class="placa">{{ o.vehiculo?.placa }}</span>
                  </dd>
                  <dt>Falla reportada</dt>
                  <dd class="texto-corto">{{ o.problemaReportado }}</dd>
                  @if (o.diagnostico) {
                    <dt>Diagnóstico</dt>
                    <dd class="texto-corto">{{ o.diagnostico }}</dd>
                  }
                  <dt>Mecánico</dt>
                  <dd>{{ o.mecanico?.nombre ?? 'Sin asignar' }}</dd>
                  @if (o.fechaEntregaEstimada) {
                    <dt>Entrega</dt>
                    <dd [class.rojo]="atrasada(o)">{{ o.fechaEntregaEstimada + 'T12:00:00' | date: 'EEE dd/MM' }}</dd>
                  }
                  @if (totales(o); as t) {
                    @if (t.total > 0) {
                      <dt>Total</dt>
                      <dd>
                        Bs {{ t.total | number: '1.2-2' }}
                        @if (t.saldo > 0) {
                          · <span class="saldo">saldo Bs {{ t.saldo | number: '1.2-2' }}</span>
                        } @else {
                          · <span class="pagado">pagado</span>
                        }
                      </dd>
                    }
                  }
                </dl>

                <div class="ficha-acciones">
                  <a class="accion" [routerLink]="['/ordenes', o.id, 'comprobante']"
                     [title]="o.estado === 'TERMINADO' || o.estado === 'ENTREGADO' ? 'Comprobante' : 'Presupuesto'">
                    <app-icono nombre="imprimir" />
                  </a>
                  <a class="accion" [routerLink]="['/vehiculos', o.vehiculoId]" title="Ficha del vehículo">
                    <app-icono nombre="vehiculos" />
                  </a>
                  <a class="accion llena" [routerLink]="['/ordenes', o.id]" title="Abrir orden">
                    <app-icono nombre="diagnostico" />
                  </a>
                </div>
              </div>
            </li>
          } @empty {
            <li class="vacio">No hay órdenes en esta vista.</li>
          }
        }
      </ul>
    </div>
  `,
  styles: `
    .fichas { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .ficha { padding: 14px 16px; border: 1px solid var(--borde); border-radius: 14px; background: var(--superficie); }
    .ficha:hover { border-color: #f5b30166; }
    .ficha-cab { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
    .ficha-num { font-size: 1.05rem; }
    .ficha-cuerpo { display: flex; gap: 16px; align-items: flex-end; justify-content: space-between; }
    .ficha-datos { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 0; min-width: 0; font-size: 0.9rem; }
    .ficha-datos dt { color: var(--texto-suave); font-weight: 600; }
    .ficha-datos dd { margin: 0; min-width: 0; }
    .texto-corto { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .ficha-acciones { display: flex; gap: 8px; flex-shrink: 0; }
    .accion { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px;
      border-radius: 50%; border: 2px solid #f5b301; color: #f5b301; font-size: 1.1rem; transition: all 0.15s; }
    .accion:hover { background: #f5b30122; }
    .accion.llena { background: #f5b301; color: #1a1a1a; }
    .accion.llena:hover { background: #ffc61a; }
    .etq-roja { padding: 2px 8px; border-radius: 999px; background: #ef444422; color: #ef4444; font-size: 0.75rem; font-weight: 700; }
    .rojo { color: #ef4444; font-weight: 600; }
    .saldo { color: #f5b301; font-weight: 600; }
    .pagado { color: #16a34a; font-weight: 600; }
    @media (max-width: 640px) {
      .ficha-cuerpo { flex-direction: column; align-items: stretch; }
      .ficha-acciones { justify-content: flex-end; }
    }
    .pestanas { display: flex; gap: 6px; margin: 12px 0 16px; padding: 6px; overflow-x: auto;
      border: 1px solid var(--borde); border-radius: 14px; background: var(--superficie); scrollbar-width: thin; }
    .pestana { flex: 1 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 12px 16px; border: none; border-radius: 10px; background: transparent; color: var(--texto-medio);
      font: inherit; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;
      white-space: nowrap; cursor: pointer; transition: background 0.15s, color 0.15s; }
    .pestana app-icono { font-size: 1.1rem; }
    .pestana:hover:not(.activa) { background: #ffffff0d; color: var(--texto); }
    .pestana.activa { background: #f5b301; color: #1a1a1a; box-shadow: 0 4px 14px #f5b30140; }
    .cuenta { min-width: 22px; padding: 1px 7px; border-radius: 6px; background: #f5b301; color: #1a1a1a;
      font-size: 0.75rem; font-weight: 800; text-align: center; }
    .pestana.activa .cuenta { background: #1a1a1a; color: #f5b301; }
  `,
})
export class OrdenesListaComponent {
  private readonly datos = inject(DatosService);
  private readonly sync = inject(SyncService);

  readonly filtros = FILTROS;
  readonly info = ESTADO_INFO;
  readonly numero = formatoNumero;

  readonly busqueda = new FormControl('', { nonNullable: true });
  readonly filtro = signal<Filtro>('ABIERTAS');
  readonly ordenes = signal<OrdenTrabajo[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  /** Órdenes abiertas por estado (contadores de las pestañas). */
  readonly resumen = signal<Partial<Record<string, number>>>({});

  readonly hoy = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  totales(o: OrdenTrabajo) {
    return o.totales ?? calcularTotales(o);
  }

  atrasada(o: OrdenTrabajo) {
    return !!o.fechaEntregaEstimada && ESTADOS_ABIERTOS.includes(o.estado) && o.fechaEntregaEstimada < this.hoy;
  }

  /** Entregados y Todas no llevan contador: crecen sin límite. */
  conteo(f: Filtro): number | null {
    const r = this.resumen();
    if (f === 'ENTREGADO' || f === 'TODAS') return null;
    if (f === 'ABIERTAS') return Object.values(r).reduce((s: number, n) => s + (n ?? 0), 0);
    return r[f] ?? 0;
  }

  constructor() {
    this.busqueda.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.cargar());

    // Recargar al cambiar de filtro o cuando termina una sincronización.
    effect(
      () => {
        this.filtro();
        this.sync.ultimaSync();
        this.sync.pendientes();
        this.cargar();
        this.datos.resumenOrdenes().then((r) => this.resumen.set(r)).catch(() => {});
      },
      { allowSignalWrites: true },
    );
  }

  async cargar() {
    const f = this.filtro();
    this.error.set(null);
    try {
      const lista = await this.datos.listarOrdenes({
        abiertas: f === 'ABIERTAS',
        estado: f === 'ABIERTAS' || f === 'TODAS' ? undefined : f,
        q: this.busqueda.value,
      });
      this.ordenes.set(lista);
    } catch (err) {
      this.error.set(mensajeError(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
