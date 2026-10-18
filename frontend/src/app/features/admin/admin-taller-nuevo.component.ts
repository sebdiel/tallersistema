import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';

/** HU-25: alta de un taller cliente con su administrador. */
@Component({
  selector: 'app-admin-taller-nuevo',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <div>
          <a routerLink="/admin/talleres">← Talleres</a>
          <h1>Nuevo taller</h1>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="guardar()">
        @if (error()) {
          <div class="alerta alerta-error">{{ error() }}</div>
        }

        <section class="card">
          <h2>Datos del taller</h2>
          <div class="grid-2">
            <div class="campo">
              <label class="req" for="nombre">Nombre del taller</label>
              <input id="nombre" formControlName="nombre" />
            </div>
            <div class="campo">
              <label for="tel">Teléfono</label>
              <input id="tel" type="tel" formControlName="telefono" />
            </div>
            <div class="campo">
              <label for="contacto">Persona de contacto (dueño)</label>
              <input id="contacto" formControlName="contactoNombre" />
            </div>
            <div class="campo">
              <label for="nit">NIT</label>
              <input id="nit" formControlName="nit" />
            </div>
          </div>
          <div class="campo" style="margin-top: 12px">
            <label for="dir">Dirección</label>
            <input id="dir" formControlName="direccion" />
          </div>
          <div class="campo" style="margin-top: 12px; max-width: 220px">
            <label for="prueba">Días de prueba gratis</label>
            <input id="prueba" type="number" min="0" max="90" formControlName="diasPrueba" />
          </div>
        </section>

        <section class="card" formGroupName="admin">
          <h2>Administrador del taller</h2>
          <p class="item-sub" style="margin-top: 0">Con este usuario el dueño ingresa y registra a sus mecánicos.</p>
          <div class="grid-2">
            <div class="campo">
              <label class="req" for="anombre">Nombre</label>
              <input id="anombre" formControlName="nombre" />
            </div>
            <div class="campo">
              <label class="req" for="aemail">Correo</label>
              <input id="aemail" type="email" formControlName="email" />
            </div>
            <div class="campo">
              <label class="req" for="apass">Contraseña inicial</label>
              <input id="apass" type="text" formControlName="password" autocomplete="off" />
              <span class="item-sub">Mínimo 8 caracteres. Entréguela al dueño y pídale que la cambie.</span>
            </div>
          </div>
        </section>

        <div class="acciones">
          <a class="btn btn-sec" routerLink="/admin/talleres">Cancelar</a>
          <button class="btn" type="submit" [disabled]="form.invalid || guardando()">
            {{ guardando() ? 'Creando…' : 'Crear taller' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class AdminTallerNuevoComponent {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    telefono: [''],
    contactoNombre: [''],
    nit: [''],
    direccion: [''],
    diasPrueba: [15, [Validators.min(0), Validators.max(90)]],
    admin: inject(FormBuilder).nonNullable.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    }),
  });

  async guardar() {
    this.guardando.set(true);
    this.error.set(null);
    try {
      const d = await firstValueFrom(this.api.crear(this.form.getRawValue()));
      this.router.navigate(['/admin/talleres', d.taller.id]);
    } catch (err) {
      this.error.set(mensajeError(err));
      this.guardando.set(false);
    }
  }
}
