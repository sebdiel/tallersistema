import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ConexionService } from '../../core/conexion.service';
import { DatosService } from '../../core/datos.service';
import { ESTADOS_ABIERTOS, ESTADO_INFO } from '../../core/estados';
import { ROL_LABEL } from '../../core/models';
import { SyncService } from '../../core/sync.service';
import { IconoComponent } from '../../layout/icono.component';

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

  async ngOnInit() {
    if (this.auth.tieneRol('SUPERADMIN')) return;
    this.datos.resumenOrdenes().then((r) => this.resumen.set(r)).catch(() => {});
  }

}
