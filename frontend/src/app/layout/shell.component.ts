import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ConexionService } from '../core/conexion.service';
import { ROL_LABEL, Rol } from '../core/models';

interface ItemMenu {
  ruta: string;
  texto: string;
  icono: string;
  roles: Rol[];
}

const MENU: ItemMenu[] = [
  { ruta: '/', texto: 'Inicio', icono: '🏠', roles: ['ADMIN', 'MECANICO', 'SUPERADMIN'] },
  { ruta: '/clientes', texto: 'Clientes', icono: '👤', roles: ['ADMIN', 'MECANICO'] },
  { ruta: '/vehiculos', texto: 'Vehículos', icono: '🚗', roles: ['ADMIN', 'MECANICO'] },
  { ruta: '/usuarios', texto: 'Usuarios', icono: '🔧', roles: ['ADMIN'] },
];

/** Estructura principal: barra superior + menú lateral (escritorio) o inferior (móvil). */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly conexion = inject(ConexionService);
  readonly rolLabel = ROL_LABEL;

  // HU-03: el menú solo muestra lo que el rol puede usar.
  readonly menu = computed(() => {
    const rol = this.auth.usuario()?.rol;
    return MENU.filter((m) => rol && m.roles.includes(rol));
  });
}
