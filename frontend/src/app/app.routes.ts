import { Routes } from '@angular/router';
import { authGuard, invitadoGuard, rolGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [invitadoGuard],
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/inicio/inicio.component').then((m) => m.InicioComponent),
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
