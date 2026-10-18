import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AlertasApi } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConexionService } from '../../core/conexion.service';
import { DatosService } from '../../core/datos.service';
import { ESTADOS_ABIERTOS, ESTADO_INFO } from '../../core/estados';
import { Alerta } from '../../core/models';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Hola, {{ auth.usuario()?.nombre }}</h1>
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

        <!-- RN-12 / RN-13: alertas del motor de reglas -->
        @if (alertas().length) {
          <section class="card">
            <h2>🔔 Alertas</h2>
            <ul class="lista">
              @for (a of alertas(); track a.id) {
                <li class="item" style="box-shadow: none; border: 1px solid var(--borde)">
                  @if (a.tipo === 'SUSCRIPCION') {
                    <span>💳 {{ a.mensaje }}</span>
                  } @else {
                    <a [routerLink]="a.tipo === 'STOCK_BAJO' ? ['/inventario', a.referenciaId] : ['/ordenes', a.referenciaId]">
                      {{ a.tipo === 'STOCK_BAJO' ? '📦' : '✅' }} {{ a.mensaje }}
                    </a>
                  }
                  @if (a.tipo === 'ORDEN_TERMINADA') {
                    <button class="btn btn-sec" style="min-height: 34px" (click)="resolver(a)">Ya avisé</button>
                  }
                </li>
              }
            </ul>
          </section>
        } @else if (!conexion.enLinea()) {
          <p class="item-sub">Las alertas se muestran cuando hay conexión.</p>
        }

        <div class="accesos">
          <a class="card acceso" routerLink="/vehiculos">
            <span class="icono">🔎</span>
            <strong>Buscar vehículo</strong>
            <small>Por placa, marca o modelo</small>
          </a>
          <a class="card acceso" routerLink="/inventario">
            <span class="icono">📦</span>
            <strong>Inventario</strong>
            <small>Stock de repuestos</small>
          </a>
          <a class="card acceso" routerLink="/clientes/nuevo">
            <span class="icono">➕</span>
            <strong>Nuevo cliente</strong>
            <small>Registrar propietario</small>
          </a>
          @if (auth.tieneRol('ADMIN')) {
            <a class="card acceso" routerLink="/usuarios">
              <span class="icono">🔧</span>
              <strong>Personal</strong>
              <small>Gestionar mecánicos</small>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
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
  private readonly datos = inject(DatosService);
  private readonly alertasApi = inject(AlertasApi);

  readonly estados = ESTADOS_ABIERTOS;
  readonly info = ESTADO_INFO;
  readonly resumen = signal<Partial<Record<string, number>>>({});
  readonly alertas = signal<Alerta[]>([]);

  async ngOnInit() {
    if (this.auth.tieneRol('SUPERADMIN')) return;
    this.datos.resumenOrdenes().then((r) => this.resumen.set(r)).catch(() => {});
    try {
      this.alertas.set(await firstValueFrom(this.alertasApi.listar()));
    } catch {
      // Sin conexión: las alertas son del servidor.
    }
  }

  async resolver(a: Alerta) {
    await firstValueFrom(this.alertasApi.resolver(a.id));
    this.alertas.update((l) => l.filter((x) => x.id !== a.id));
  }
}
