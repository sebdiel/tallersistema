import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Hola, {{ auth.usuario()?.nombre }}</h1>
      </div>

      @if (auth.tieneRol('SUPERADMIN')) {
        <div class="alerta alerta-info">
          El panel de administración global (talleres y suscripciones) estará disponible próximamente.
        </div>
      } @else {
        <div class="accesos">
          <a class="card acceso" routerLink="/vehiculos">
            <span class="icono">🔎</span>
            <strong>Buscar vehículo</strong>
            <small>Por placa, marca o modelo</small>
          </a>
          <a class="card acceso" routerLink="/clientes/nuevo">
            <span class="icono">➕</span>
            <strong>Nuevo cliente</strong>
            <small>Registrar propietario</small>
          </a>
          <a class="card acceso" routerLink="/vehiculos/nuevo">
            <span class="icono">🚗</span>
            <strong>Nuevo vehículo</strong>
            <small>Registrar ficha técnica</small>
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
    .acceso:hover {
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
export class InicioComponent {
  readonly auth = inject(AuthService);
}
