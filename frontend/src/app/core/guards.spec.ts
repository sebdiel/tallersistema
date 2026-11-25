import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard, rolGuard } from './guards';
import { Rol } from './models';

describe('Acceso a rutas por sesión y rol', () => {
  let rol: Rol;
  let autenticado: boolean;
  beforeEach(() => {
    rol = 'ADMIN'; autenticado = true;
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: {
      autenticado: () => autenticado, tieneRol: (...roles: Rol[]) => autenticado && roles.includes(rol),
    } }] });
  });
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;
  it('redirige a login si falta sesión', () => {
    autenticado = false;
    const resultado = TestBed.runInInjectionContext(() => authGuard(route, state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/login');
  });
  it('permite al administrador ingresar a rutas administrativas', () => {
    expect(TestBed.runInInjectionContext(() => rolGuard('ADMIN')(route, state))).toBeTrue();
  });
  it('rechaza al mecánico en rutas administrativas', () => {
    rol = 'MECANICO';
    const resultado = TestBed.runInInjectionContext(() => rolGuard('ADMIN')(route, state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/');
  });
  it('rechaza al administrador de taller en el panel del SuperAdmin', () => {
    const resultado = TestBed.runInInjectionContext(() => rolGuard('SUPERADMIN')(route, state)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/');
  });
});
