import { Routes } from '@angular/router';
import { authGuard, inicioPorRolGuard, invitadoGuard, rolGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [invitadoGuard],
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  // Comprobante a pantalla completa (sin menú) para imprimir / PDF.
  {
    path: 'ordenes/:id/comprobante',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/ordenes/comprobante.component').then((m) => m.ComprobanteComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        canActivate: [inicioPorRolGuard],
        loadComponent: () =>
          import('./features/inicio/inicio.component').then((m) => m.InicioComponent),
      },
      // ------------------------------------------------ Iteración 4 (SUPERADMIN)
      {
        path: 'admin',
        canActivate: [rolGuard('SUPERADMIN')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/admin/admin-panel.component').then((m) => m.AdminPanelComponent),
          },
          {
            path: 'talleres',
            loadComponent: () =>
              import('./features/admin/admin-talleres.component').then((m) => m.AdminTalleresComponent),
          },
          {
            path: 'talleres/nuevo',
            loadComponent: () =>
              import('./features/admin/admin-taller-nuevo.component').then(
                (m) => m.AdminTallerNuevoComponent,
              ),
          },
          {
            path: 'talleres/:id',
            loadComponent: () =>
              import('./features/admin/admin-taller-detalle.component').then(
                (m) => m.AdminTallerDetalleComponent,
              ),
          },
        ],
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/clientes/clientes-lista.component').then(
            (m) => m.ClientesListaComponent,
          ),
      },
      {
        path: 'clientes/nuevo',
        loadComponent: () =>
          import('./features/clientes/cliente-form.component').then(
            (m) => m.ClienteFormComponent,
          ),
      },
      {
        path: 'clientes/:id',
        loadComponent: () =>
          import('./features/clientes/cliente-detalle.component').then(
            (m) => m.ClienteDetalleComponent,
          ),
      },
      {
        path: 'clientes/:id/editar',
        loadComponent: () =>
          import('./features/clientes/cliente-form.component').then(
            (m) => m.ClienteFormComponent,
          ),
      },
      {
        path: 'vehiculos',
        loadComponent: () =>
          import('./features/vehiculos/vehiculos-lista.component').then(
            (m) => m.VehiculosListaComponent,
          ),
      },
      {
        path: 'vehiculos/nuevo',
        loadComponent: () =>
          import('./features/vehiculos/vehiculo-form.component').then(
            (m) => m.VehiculoFormComponent,
          ),
      },
      {
        path: 'vehiculos/:id',
        loadComponent: () =>
          import('./features/vehiculos/vehiculo-ficha.component').then(
            (m) => m.VehiculoFichaComponent,
          ),
      },
      {
        path: 'vehiculos/:id/editar',
        loadComponent: () =>
          import('./features/vehiculos/vehiculo-form.component').then(
            (m) => m.VehiculoFormComponent,
          ),
      },
      // ------------------------------------------------ Iteración 2
      {
        path: 'ordenes',
        loadComponent: () =>
          import('./features/ordenes/ordenes-lista.component').then((m) => m.OrdenesListaComponent),
      },
      {
        path: 'ordenes/nueva',
        loadComponent: () =>
          import('./features/ordenes/orden-nueva.component').then((m) => m.OrdenNuevaComponent),
      },
      {
        path: 'ordenes/:id',
        loadComponent: () =>
          import('./features/ordenes/orden-detalle.component').then((m) => m.OrdenDetalleComponent),
      },
      {
        path: 'inventario',
        loadComponent: () =>
          import('./features/inventario/inventario-lista.component').then(
            (m) => m.InventarioListaComponent,
          ),
      },
      {
        path: 'inventario/nuevo',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () =>
          import('./features/inventario/repuesto-form.component').then((m) => m.RepuestoFormComponent),
      },
      {
        path: 'inventario/:id',
        loadComponent: () =>
          import('./features/inventario/repuesto-detalle.component').then(
            (m) => m.RepuestoDetalleComponent,
          ),
      },
      {
        path: 'inventario/:id/editar',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () =>
          import('./features/inventario/repuesto-form.component').then((m) => m.RepuestoFormComponent),
      },
      {
        path: 'sincronizacion',
        loadComponent: () =>
          import('./features/sync/sincronizacion.component').then((m) => m.SincronizacionComponent),
      },
      // ------------------------------------------------ Iteración 3
      {
        path: 'indicadores',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'configuracion',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () =>
          import('./features/configuracion/configuracion.component').then(
            (m) => m.ConfiguracionComponent,
          ),
      },
      {
        path: 'usuarios',
        canActivate: [rolGuard('ADMIN')],
        loadComponent: () =>
          import('./features/usuarios/usuarios.component').then(
            (m) => m.UsuariosComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
