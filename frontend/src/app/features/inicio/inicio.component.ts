import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ConexionService } from '../../core/conexion.service';
import { DatosService } from '../../core/datos.service';
import { ESTADOS_ABIERTOS, ESTADO_INFO } from '../../core/estados';
import { OrdenTrabajo, ROL_LABEL, formatoNumero } from '../../core/models';
import { SyncService } from '../../core/sync.service';
import { IconoComponent } from '../../layout/icono.component';

const aIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [IconoComponent, RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <div>
          <h1>Hola, {{ auth.usuario()?.nombre }}</h1>
          <!-- Celular: estado de conexión y rol (en escritorio están en la barra superior) -->
          <div class="chips-movil">
            <a class="chip" routerLink="/sincronizacion" [class.offline]="!conexion.enLinea()">
              <span class="punto"></span>
              {{ conexion.enLinea() ? (sync.sincronizando() ? 'Sincronizando' : 'En línea') : 'Sin conexión' }}
              @if (sync.pendientes()) {
                · {{ sync.pendientes() }} pendiente(s)
              }
            </a>
            @if (auth.usuario(); as u) {
              <span class="chip">{{ rolLabel[u.rol] }}</span>
            }
          </div>
        </div>
        @if (!auth.tieneRol('SUPERADMIN')) {
          <a class="btn" routerLink="/ordenes/nueva">+ Recibir vehículo</a>
        }
      </div>

      @if (auth.tieneRol('SUPERADMIN')) {
        <div class="alerta alerta-info">
          El panel de administración global (talleres y suscripciones) estará disponible próximamente.
        </div>
      } @else {
        <!-- Tablero de órdenes abiertas por estado -->
        <div class="tablero">
          @for (e of estados; track e) {
            <a class="card contador" routerLink="/ordenes">
              <span class="cifra">{{ resumen()[e] ?? 0 }}</span>
              <span [class]="'estado-ot ' + info[e].clase">{{ info[e].texto }}</span>
            </a>
          }
        </div>

        <!-- RN-26: agenda de entregas -->
        <section class="card agenda">
          <div class="agenda-cab">
            <h2>Entregas próximas</h2>
            @if (atrasadas().length) {
              <button type="button" class="chip-atraso" [class.activo]="dia() === 'atrasadas'" (click)="dia.set('atrasadas')">
                <app-icono nombre="alerta" /> {{ atrasadas().length }} atrasada(s)
              </button>
            }
          </div>
          <div class="dias">
            @for (d of dias(); track d.fecha) {
              <button type="button" class="dia" [class.elegido]="dia() === d.fecha" [class.ocupado]="d.ordenes.length > 0" (click)="dia.set(d.fecha)">
                <span class="dsem">{{ d.semana }}</span>
                <strong>{{ d.num }}</strong>
                <span class="dmes">{{ d.mes }}</span>
                <span class="destado">{{ d.ordenes.length ? d.ordenes.length + ' auto(s)' : 'Libre' }}</span>
              </button>
            }
          </div>

          <h3 class="dia-titulo" [class.rojo]="dia() === 'atrasadas'">{{ tituloDia() }}</h3>
          <ul class="lista">
            @for (o of ordenesDia(); track o.id) {
              <li>
                <a class="item" [routerLink]="['/ordenes', o.id]">
                  <div>
                    <div class="item-titulo"><span class="placa">{{ o.vehiculo?.placa }}</span> {{ o.vehiculo?.marca }} {{ o.vehiculo?.modelo }}</div>
                    <div class="item-sub">
                      {{ numero(o.numero) }} · {{ o.cliente?.nombre }}
                      @if (dia() === 'atrasadas') {
                        · <span class="rojo">debía entregarse el {{ corta(o.fechaEntregaEstimada!) }}</span>
                      }
                    </div>
                  </div>
                  <span [class]="'estado-ot ' + info[o.estado].clase">{{ info[o.estado].texto }}</span>
                </a>
              </li>
            } @empty {
              <li class="vacio">No hay vehículos para entregar este día.</li>
            }
          </ul>
        </section>

        <div class="accesos">
          <a class="card acceso" routerLink="/vehiculos">
            <app-icono class="icono" nombre="buscar" />
            <strong>Buscar vehículo</strong>
            <small>Por placa, marca o modelo</small>
          </a>
          <a class="card acceso" routerLink="/inventario">
            <app-icono class="icono" nombre="inventario" />
            <strong>Inventario</strong>
            <small>Stock de repuestos</small>
          </a>
          <a class="card acceso" routerLink="/clientes/nuevo">
            <app-icono class="icono" nombre="agregar" />
            <strong>Nuevo cliente</strong>
            <small>Registrar propietario</small>
          </a>
          @if (auth.tieneRol('ADMIN')) {
            <a class="card acceso" routerLink="/usuarios">
              <app-icono class="icono" nombre="personal" />
              <strong>Personal</strong>
              <small>Gestionar mecánicos</small>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .chips-movil {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      border: 1px solid var(--borde);
      font-size: 0.8rem;
      color: var(--texto-medio);
    }
    .punto {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
    }
    .chip.offline .punto {
      background: var(--peligro);
    }
    @media (min-width: 900px) {
      .chips-movil {
        display: none;
      }
    }
    .tablero {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, 1fr);
      margin-bottom: 16px;
    }
    @media (min-width: 640px) {
      .tablero {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    .contador {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      margin: 0;
      color: var(--texto);
    }
    .cifra {
      font-size: 2rem;
      font-weight: 700;
    }
    .accesos {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }
    .acceso {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0;
      color: var(--texto);
    }
    .acceso:hover,
    .contador:hover {
      outline: 2px solid var(--primario-claro);
    }
    .icono {
      font-size: 1.8rem;
    }
    small {
      color: var(--texto-suave);
    }
    .agenda { margin-bottom: 16px; }
    .agenda-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .agenda-cab h2 { margin: 0; }
    .chip-atraso { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px;
      border: 1px solid #ef4444; background: #ef444418; color: #ef4444; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .chip-atraso.activo { background: #ef4444; color: #fff; }
    .dias { display: flex; gap: 8px; overflow-x: auto; padding: 12px 0 6px; scrollbar-width: thin; }
    .dia { flex: 0 0 76px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px;
      border-radius: 10px; border: 1px solid var(--borde); background: var(--superficie); color: var(--texto); font: inherit; cursor: pointer; }
    .dia strong { font-size: 1.3rem; }
    .dsem, .dmes { font-size: 0.72rem; text-transform: uppercase; color: var(--texto-suave); }
    .destado { font-size: 0.7rem; color: #16a34a; font-weight: 600; }
    .dia.ocupado { border-color: #d97706; }
    .dia.ocupado .destado { color: #d97706; }
    .dia.elegido { background: #f5b301; border-color: #f5b301; color: #1a1a1a; }
    .dia.elegido .dsem, .dia.elegido .dmes, .dia.elegido .destado { color: #1a1a1a; }
    .dia-titulo { margin: 12px 0 8px; font-size: 0.95rem; text-transform: capitalize; }
    .rojo { color: #ef4444; }
  `,
})
export class InicioComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly conexion = inject(ConexionService);
  readonly sync = inject(SyncService);
  readonly rolLabel = ROL_LABEL;
  private readonly datos = inject(DatosService);

  readonly estados = ESTADOS_ABIERTOS;
  readonly info = ESTADO_INFO;
  readonly resumen = signal<Partial<Record<string, number>>>({});

  // RN-26: agenda de entregas (órdenes abiertas con fecha acordada)
  readonly numero = formatoNumero;
  readonly hoy = aIso(new Date());
  readonly agenda = signal<Record<string, OrdenTrabajo[]>>({});
  /** Día elegido (AAAA-MM-DD) o 'atrasadas'. */
  readonly dia = signal<string>(this.hoy);
  readonly dias = computed(() => {
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
  readonly atrasadas = computed(() =>
    Object.entries(this.agenda())
      .filter(([fecha]) => fecha < this.hoy)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([, ordenes]) => ordenes),
  );
  readonly ordenesDia = computed(() =>
    this.dia() === 'atrasadas' ? this.atrasadas() : (this.agenda()[this.dia()] ?? []),
  );
  readonly tituloDia = computed(() => {
    const d = this.dia();
    if (d === 'atrasadas') return 'Entregas atrasadas';
    const texto = new Date(d + 'T12:00:00').toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });
    return d === this.hoy ? `Hoy, ${texto}` : texto;
  });

  async ngOnInit() {
    if (this.auth.tieneRol('SUPERADMIN')) return;
    this.datos.resumenOrdenes().then((r) => this.resumen.set(r)).catch(() => {});
    this.datos.agendaEntregas().then((a) => this.agenda.set(a)).catch(() => {});
  }

  corta(fecha: string) {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
  }

}
