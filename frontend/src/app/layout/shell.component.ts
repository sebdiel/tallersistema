import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ConexionService } from '../core/conexion.service';
import { ROL_LABEL, Rol } from '../core/models';
import { SyncService } from '../core/sync.service';

interface ItemMenu {
  ruta: string;
  texto: string;
  icono: string;
  roles: Rol[];
  /** Visible siempre en la barra inferior del celular; el resto va en "Más". */
  principal?: boolean;
}

const MENU: ItemMenu[] = [
  // SUPERADMIN (Iteración 4): administración global del sistema comercial.
  { ruta: '/admin', texto: 'Panel', icono: '📈', roles: ['SUPERADMIN'], principal: true },
  { ruta: '/admin/talleres', texto: 'Talleres', icono: '🏪', roles: ['SUPERADMIN'], principal: true },
  { ruta: '/', texto: 'Inicio', icono: '🏠', roles: ['ADMIN', 'MECANICO'], principal: true },
  { ruta: '/ordenes', texto: 'Órdenes', icono: '📋', roles: ['ADMIN', 'MECANICO'], principal: true },
  { ruta: '/vehiculos', texto: 'Vehículos', icono: '🚗', roles: ['ADMIN', 'MECANICO'], principal: true },
  { ruta: '/inventario', texto: 'Inventario', icono: '📦', roles: ['ADMIN', 'MECANICO'], principal: true },
  { ruta: '/indicadores', texto: 'Indicadores', icono: '📊', roles: ['ADMIN'] },
  { ruta: '/clientes', texto: 'Clientes', icono: '👤', roles: ['ADMIN', 'MECANICO'] },
  { ruta: '/configuracion', texto: 'Configuración', icono: '⚙️', roles: ['ADMIN'] },
  { ruta: '/usuarios', texto: 'Personal', icono: '🔧', roles: ['ADMIN'] },
  { ruta: '/sincronizacion', texto: 'Sincronización', icono: '⟳', roles: ['ADMIN', 'MECANICO'] },
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
  readonly sync = inject(SyncService);
  readonly rolLabel = ROL_LABEL;

  /** Hoja "Más" del menú inferior (móvil). */
  readonly masAbierto = signal(false);

  // HU-03: el menú solo muestra lo que el rol puede usar.
  readonly menu = computed(() => {
    const rol = this.auth.usuario()?.rol;
    return MENU.filter((m) => rol && m.roles.includes(rol));
  });
  readonly principales = computed(() => this.menu().filter((m) => m.principal));
  readonly secundarios = computed(() => this.menu().filter((m) => !m.principal));

  constructor() {
    // El SUPERADMIN no opera un taller: no necesita datos offline.
    if (!this.auth.tieneRol('SUPERADMIN')) {
      this.sync.iniciar();
      // Estado de la suscripción al día (aviso de vencimiento).
      this.auth.refrescarPerfil();
    }

    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.masAbierto.set(false));
  }

  async salir() {
    await this.sync.limpiarCache();
    this.auth.logout();
  }
}
