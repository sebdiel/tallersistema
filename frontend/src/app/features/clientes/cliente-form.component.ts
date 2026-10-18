import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClientesApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';

/** HU-04: registrar / editar cliente. */
@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>{{ id() ? 'Editar cliente' : 'Nuevo cliente' }}</h1>
      </div>

      <form class="card" [formGroup]="form" (ngSubmit)="guardar()">
        @if (error()) {
          <div class="alerta alerta-error">{{ error() }}</div>
        }

        <div class="grid-2">
          <div class="campo" [class.invalido]="invalido('nombre')">
            <label for="nombre" class="req">Nombre completo</label>
            <input id="nombre" formControlName="nombre" />
            @if (invalido('nombre')) {
              <span class="error-campo">Mínimo 3 caracteres</span>
            }
          </div>

          <div class="campo" [class.invalido]="invalido('telefono')">
            <label for="telefono" class="req">Teléfono / Celular</label>
            <input id="telefono" type="tel" inputmode="tel" formControlName="telefono" />
            @if (invalido('telefono')) {
              <span class="error-campo">Teléfono inválido (7 a 20 dígitos)</span>
            }
          </div>

          <div class="campo" [class.invalido]="invalido('ciNit')">
            <label for="ciNit">CI / NIT</label>
            <input id="ciNit" formControlName="ciNit" />
            @if (invalido('ciNit')) {
              <span class="error-campo">CI/NIT inválido</span>
            }
          </div>

          <div class="campo" [class.invalido]="invalido('email')">
            <label for="email">Correo electrónico</label>
            <input id="email" type="email" formControlName="email" />
            @if (invalido('email')) {
              <span class="error-campo">Correo inválido</span>
            }
          </div>
        </div>

        <div class="campo" style="margin-top: 12px">
          <label for="direccion">Dirección</label>
          <input id="direccion" formControlName="direccion" />
        </div>

        <div class="acciones">
          <a class="btn btn-sec" [routerLink]="id() ? ['/clientes', id()] : ['/clientes']">Cancelar</a>
          <button class="btn" type="submit" [disabled]="guardando()">
            {{ guardando() ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ClienteFormComponent implements OnInit {
  private readonly api = inject(ClientesApi);
  private readonly router = inject(Router);

  /** Parámetro de ruta (solo al editar). */
  readonly id = input<string>();

  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    telefono: ['', [Validators.required, Validators.pattern(/^[0-9+\s-]{7,20}$/)]],
    ciNit: ['', Validators.pattern(/^[0-9A-Za-z-]{4,20}$/)],
    email: ['', Validators.email],
    direccion: ['', Validators.maxLength(200)],
  });

  ngOnInit() {
    const id = this.id();
    if (!id) return;
    this.api.obtener(id).subscribe({
      next: (c) =>
        this.form.patchValue({
          nombre: c.nombre,
          telefono: c.telefono,
          ciNit: c.ciNit ?? '',
          email: c.email ?? '',
          direccion: c.direccion ?? '',
        }),
      error: (err) => this.error.set(mensajeError(err)),
    });
  }

  invalido(campo: keyof typeof this.form.controls) {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || c.dirty);
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);

    const datos = this.form.getRawValue();
    const id = this.id();
    const peticion = id ? this.api.actualizar(id, datos) : this.api.crear(datos);

    peticion.subscribe({
      next: (c) => this.router.navigate(['/clientes', c.id]),
      error: (err) => {
        this.error.set(mensajeError(err));
        this.guardando.set(false);
      },
    });
  }
}
