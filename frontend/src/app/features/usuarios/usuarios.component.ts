import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { ROL_LABEL, Rol, Usuario } from '../../core/models';

/** HU-02: el administrador gestiona al personal del taller. */
@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Personal del taller</h1>
        @if (!editando()) {
          <button class="btn" (click)="nuevo()">+ Nuevo usuario</button>
        }
      </div>

      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }

      @if (editando()) {
        <form class="card" [formGroup]="form" (ngSubmit)="guardar()">
          <h2>{{ seleccionado() ? 'Editar usuario' : 'Nuevo usuario' }}</h2>
          <div class="grid-2">
            <div class="campo">
              <label for="nombre" class="req">Nombre</label>
              <input id="nombre" formControlName="nombre" />
            </div>
            <div class="campo">
              <label for="email" class="req">Correo</label>
              <input id="email" type="email" formControlName="email" />
            </div>
            <div class="campo">
              <label for="rol" class="req">Rol</label>
              <select id="rol" formControlName="rol">
                <option value="MECANICO">Mecánico</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div class="campo">
              <label for="password" [class.req]="!seleccionado()">
                {{ seleccionado() ? 'Nueva contraseña (opcional)' : 'Contraseña' }}
              </label>
              <input id="password" type="password" formControlName="password" autocomplete="new-password" />
              <span class="item-sub">Mínimo 6 caracteres</span>
            </div>
          </div>
          <div class="acciones">
            <button type="button" class="btn btn-sec" (click)="cancelar()">Cancelar</button>
            <button class="btn" type="submit" [disabled]="form.invalid || guardando()">
              {{ guardando() ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </form>
      }

      <ul class="lista">
        @for (u of usuarios(); track u.id) {
          <li class="item">
            <div>
              <div class="item-titulo">
                {{ u.nombre }}
                @if (u.id === auth.usuario()?.id) {
                  <span class="etiqueta">Tú</span>
                }
              </div>
              <div class="item-sub">{{ u.email }} · {{ rolLabel[u.rol] }}</div>
            </div>
            <div class="botones">
              <span class="etiqueta" [class.etiqueta-ok]="u.activo" [class.etiqueta-off]="!u.activo">
                {{ u.activo ? 'Activo' : 'Inactivo' }}
              </span>
              <button class="btn btn-sec" (click)="editar(u)">Editar</button>
              @if (u.id !== auth.usuario()?.id) {
                <button class="btn btn-sec" (click)="cambiarEstado(u)">
                  {{ u.activo ? 'Desactivar' : 'Activar' }}
                </button>
              }
            </div>
          </li>
        } @empty {
          <li class="vacio">Cargando…</li>
        }
      </ul>
    </div>
  `,
  styles: `
    .item {
      flex-wrap: wrap;
    }
    .botones {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
  `,
})
export class UsuariosComponent implements OnInit {
  private readonly api = inject(UsuariosApi);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  readonly rolLabel = ROL_LABEL;

  readonly usuarios = signal<Usuario[]>([]);
  readonly seleccionado = signal<Usuario | null>(null);
  readonly editando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    rol: ['MECANICO' as Rol, Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.api.listar().subscribe({
      next: (lista) => this.usuarios.set(lista),
      error: (err) => this.error.set(mensajeError(err)),
    });
  }

  nuevo() {
    this.seleccionado.set(null);
    this.form.reset({ rol: 'MECANICO' });
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
    this.editando.set(true);
  }

  editar(u: Usuario) {
    this.seleccionado.set(u);
    this.form.reset({ nombre: u.nombre, email: u.email, rol: u.rol, password: '' });
    // Al editar, la contraseña es opcional.
    this.form.controls.password.setValidators([Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
    // Un admin no puede cambiar su propio rol.
    if (u.id === this.auth.usuario()?.id) this.form.controls.rol.disable();
    else this.form.controls.rol.enable();
    this.editando.set(true);
  }

  cancelar() {
    this.editando.set(false);
    this.error.set(null);
  }

  guardar() {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.error.set(null);

    const { password, ...resto } = this.form.value;
    const sel = this.seleccionado();
    const peticion = sel
      ? this.api.actualizar(sel.id, { ...resto, ...(password ? { password } : {}) })
      : this.api.crear({ ...resto, password: password! });

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.editando.set(false);
        this.cargar();
      },
      error: (err) => {
        this.error.set(mensajeError(err));
        this.guardando.set(false);
      },
    });
  }

  cambiarEstado(u: Usuario) {
    this.api.actualizar(u.id, { activo: !u.activo }).subscribe({
      next: () => this.cargar(),
      error: (err) => this.error.set(mensajeError(err)),
    });
  }
}
