import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, tap } from 'rxjs';
import { API_URL } from './config';
import { InfoSuscripcion, LoginResponse, Rol, UsuarioSesion } from './models';

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

  /** Estado de la suscripción del taller (Iteración 4). */
  readonly suscripcion = computed(() => this._usuario()?.taller?.suscripcion ?? null);

  /** Por qué se cerró la sesión (p. ej. taller suspendido); se muestra en el login. */
  readonly motivoSalida = signal<string | null>(null);

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
          this.guardarUsuario(res.usuario);
          this.motivoSalida.set(null);
        }),
      );
  }

  /** Actualiza el estado de la suscripción (aviso de vencimiento) sin volver a iniciar sesión. */
  async refrescarPerfil() {
    const u = this._usuario();
    if (!u?.taller) return;
    try {
      const perfil = await firstValueFrom(
        this.http.get<{ taller: { suscripcion: InfoSuscripcion } | null }>(`${API_URL}/auth/me`),
      );
      if (perfil.taller) {
        this.guardarUsuario({ ...u, taller: { ...u.taller, suscripcion: perfil.taller.suscripcion } });
      }
    } catch {
      // Sin conexión: se conserva el último estado conocido.
    }
  }

  logout(motivo?: string): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._usuario.set(null);
    this.motivoSalida.set(motivo ?? null);
    this.router.navigate(['/login']);
  }

  private guardarUsuario(u: UsuarioSesion) {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    this._usuario.set(u);
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
