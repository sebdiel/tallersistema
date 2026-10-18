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

type Filtro = 'ABIERTAS' | 'TODAS' | EstadoOrden;

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'ABIERTAS', texto: 'En el taller' },
  { valor: 'RECIBIDO', texto: 'Recibidos' },
  { valor: 'EN_DIAGNOSTICO', texto: 'Diagnóstico' },
  { valor: 'EN_REPARACION', texto: 'Reparación' },
  { valor: 'TERMINADO', texto: 'Listos' },
  { valor: 'ENTREGADO', texto: 'Entregados' },
  { valor: 'TODAS', texto: 'Todas' },
];

/** HU-10: tablero de órdenes de trabajo por estado. */
@Component({
  selector: 'app-ordenes-lista',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
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

      <div class="filtros">
        @for (f of filtros; track f.valor) {
          <button [class.activo]="filtro() === f.valor" (click)="filtro.set(f.valor)">
            {{ f.texto }}
          </button>
        }
      </div>

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
                      · 🔧 {{ o.mecanico.nombre }}
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
