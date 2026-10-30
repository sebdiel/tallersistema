import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { mensajeError } from '../../core/auth.interceptor';
import { DatosService } from '../../core/datos.service';
import { ESTADO_INFO } from '../../core/estados';
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
  imports: [IconoComponent, ReactiveFormsModule, RouterLink, DatePipe],
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

      <ul class="lista">
        @if (cargando()) {
          <li class="vacio">Cargando…</li>
        } @else {
          @for (o of ordenes(); track o.id) {
            <li>
              <a class="item" [routerLink]="['/ordenes', o.id]">
                <div style="min-width: 0">
                  <div class="item-titulo">
                    {{ numero(o.numero) }} · <span class="placa">{{ o.vehiculo?.placa }}</span>
                  </div>
                  <div class="item-sub">
                    {{ o.vehiculo?.marca }} {{ o.vehiculo?.modelo }} · {{ o.cliente?.nombre }}
                  </div>
                  <div class="item-sub">
                    🕒 {{ o.fechaIngreso | date: 'dd/MM HH:mm' }}
                    @if (o.mecanico) {
                      · <app-icono nombre="personal" /> {{ o.mecanico.nombre }}
                    } @else {
                      · <em>sin mecánico</em>
                    }
                  </div>
                </div>
                <div style="text-align: right">
                  <span [class]="'estado-ot ' + info[o.estado].clase">
                    {{ info[o.estado].texto }}
                  </span>
                  @if (o._pendiente) {
                    <div style="margin-top: 4px"><span class="pendiente-sync">⟳ sin sincronizar</span></div>
                  }
                </div>
              </a>
            </li>
          } @empty {
            <li class="vacio">No hay órdenes en esta vista.</li>
          }
        }
      </ul>
    </div>
  `,
  styles: `
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
