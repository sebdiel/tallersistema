import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AlertasService } from '../core/alertas.service';
import { AuthService } from '../core/auth.service';
import { ConexionService } from '../core/conexion.service';
import { ROL_LABEL, Rol } from '../core/models';
import { SyncService } from '../core/sync.service';
import { IconoComponent } from './icono.component';

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
  { ruta: '/admin', texto: 'Panel', icono: 'panel', roles: ['SUPERADMIN'], principal: true },
  { ruta: '/admin/talleres', texto: 'Talleres', icono: 'talleres', roles: ['SUPERADMIN'], principal: true },
  { ruta: '/', texto: 'Inicio', icono: 'inicio', roles: ['ADMIN', 'MECANICO'], principal: true },
  { ruta: '/ordenes', texto: 'Órdenes', icono: 'ordenes', roles: ['ADMIN', 'MECANICO'], principal: true },
  { ruta: '/vehiculos', texto: 'Vehículos', icono: 'vehiculos', roles: ['ADMIN', 'MECANICO'], principal: true },
  { ruta: '/inventario', texto: 'Inventario', icono: 'inventario', roles: ['ADMIN', 'MECANICO'], principal: true },
  { ruta: '/indicadores', texto: 'Indicadores', icono: 'indicadores', roles: ['ADMIN'] },
  { ruta: '/notificaciones', texto: 'Notificaciones', icono: 'campana', roles: ['ADMIN', 'MECANICO'] },
  { ruta: '/clientes', texto: 'Clientes', icono: 'clientes', roles: ['ADMIN', 'MECANICO'] },
  { ruta: '/configuracion', texto: 'Configuración', icono: 'configuracion', roles: ['SUPERADMIN', 'ADMIN', 'MECANICO'] },
  { ruta: '/usuarios', texto: 'Personal', icono: 'personal', roles: ['ADMIN'] },
  { ruta: '/sincronizacion', texto: 'Sincronización', icono: 'sincronizacion', roles: ['ADMIN', 'MECANICO'] },
];

/** Estructura principal: barra superior + menú lateral (escritorio) o inferior (móvil). */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconoComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly conexion = inject(ConexionService);
  readonly sync = inject(SyncService);
  readonly alertas = inject(AlertasService);
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

  /** HU-27: el aviso de suscripción se muestra como ventana una vez por sesión. */
  private readonly avisoAceptado = signal(this.leerAceptado());
  readonly avisoVisible = computed(() => {
    const msg = this.auth.suscripcion()?.mensaje;
    return !!msg && msg !== this.avisoAceptado();
  });

  aceptarAviso(): void {
    const msg = this.auth.suscripcion()?.mensaje ?? '';
    this.avisoAceptado.set(msg);
    try {
      sessionStorage.setItem('avisoSuscripcion', msg);
    } catch {}
  }

  private leerAceptado(): string | null {
    try {
      return sessionStorage.getItem('avisoSuscripcion');
    } catch {
      return null;
    }
  }

  constructor() {
    // El SUPERADMIN no opera un taller: no necesita datos offline.
    if (!this.auth.tieneRol('SUPERADMIN')) {
      this.sync.iniciar();
      // Estado de la suscripción al día (aviso de vencimiento).
      this.auth.refrescarPerfil();
      this.alertas.cargar();
    }

    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.masAbierto.set(false);
        // Número de la campanita al día al cambiar de pantalla.
        if (!this.auth.tieneRol('SUPERADMIN')) this.alertas.cargar();
      });
  }

}
