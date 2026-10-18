import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_URL } from './config';
import { LoginResponse, Rol, UsuarioSesion } from './models';

const TOKEN_KEY = 'taller.token';
const USER_KEY = 'taller.usuario';

/** HU-01: maneja la sesión del usuario (token JWT + datos básicos). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _usuario = signal<UsuarioSesion | null>(leerUsuario());
  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => !!this._usuario() && !!this.token);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  tieneRol(...roles: Rol[]): boolean {
    const u = this._usuario();
    return !!u && roles.includes(u.rol);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_URL}/auth/login`, { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.accessToken);
          localStorage.setItem(USER_KEY, JSON.stringify(res.usuario));
          this._usuario.set(res.usuario);
        }),
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._usuario.set(null);
    this.router.navigate(['/login']);
  }
}

function leerUsuario(): UsuarioSesion | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
