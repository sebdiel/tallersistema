import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { mensajeError } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';

/** HU-01: inicio de sesión. */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="fondo">
      <form class="card caja" [formGroup]="form" (ngSubmit)="ingresar()">
        <div class="cabecera">
          <h1 class="marca-logo"><img class="logo-claro" src="logo-motoraapp.png" alt="MotoraApp – Gestión de talleres" /><img class="logo-oscuro" src="logo-motoraapp-oscuro.png" alt="MotoraApp – Gestión de talleres" /></h1>
        </div>

        @if (error()) {
          <div class="alerta alerta-error">{{ error() }}</div>
        } @else if (auth.motivoSalida()) {
          <div class="alerta alerta-warn">{{ auth.motivoSalida() }}</div>
        }

        <div class="campo">
          <label for="email">Correo electrónico</label>
          <input id="email" type="email" formControlName="email" autocomplete="username" />
        </div>

        <div class="campo">
          <label for="password">Contraseña</label>
          <input
            id="password"
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
        </div>

        <button class="btn btn-bloque" type="submit" [disabled]="form.invalid || cargando()">
          {{ cargando() ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>
    </div>
  `,
  styles: `
    .fondo {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 16px;
      background: var(--superficie-2);
    }
    .caja {
      width: 100%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 28px 24px;
    }
    .cabecera {
      text-align: center;
    }
    .logo {
      font-size: 2.5rem;
    }
    .cabecera p {
      margin: 4px 0 0;
      color: var(--texto-suave);
      font-size: 0.9rem;
    }
  `,
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ingresar() {
    if (this.form.invalid) return;
    this.cargando.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.error.set(mensajeError(err));
        this.cargando.set(false);
      },
    });
  }
}
