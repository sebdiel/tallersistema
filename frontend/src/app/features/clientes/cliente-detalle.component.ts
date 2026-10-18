import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ClientesApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { Cliente } from '../../core/models';

@Component({
  selector: 'app-cliente-detalle',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="pagina">
      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }

      @if (cliente(); as c) {
        <div class="encabezado">
          <div>
            <a routerLink="/clientes">← Clientes</a>
            <h1>{{ c.nombre }}</h1>
          </div>
          <a class="btn btn-sec" [routerLink]="['/clientes', c.id, 'editar']">Editar</a>
        </div>

        <section class="card">
          <h2>
            Datos de contacto
            @if (!c.activo) {
              <span class="etiqueta etiqueta-off">Desactivado</span>
            }
          </h2>
          <dl class="datos">
            <dt>Teléfono</dt>
            <dd>
              <a [href]="'tel:' + c.telefono">{{ c.telefono }}</a>
            </dd>
            <dt>CI / NIT</dt>
            <dd>{{ c.ciNit || '—' }}</dd>
            <dt>Correo</dt>
            <dd>{{ c.email || '—' }}</dd>
            <dt>Dirección</dt>
            <dd>{{ c.direccion || '—' }}</dd>
          </dl>
        </section>

        <section>
          <div class="encabezado">
            <h2 style="margin: 0">Vehículos</h2>
            @if (c.activo) {
              <a class="btn" routerLink="/vehiculos/nuevo" [queryParams]="{ clienteId: c.id }">
                + Agregar vehículo
              </a>
            }
          </div>
          <ul class="lista">
            @for (v of c.vehiculos; track v.id) {
              <li>
                <a class="item" [routerLink]="['/vehiculos', v.id]">
                  <div>
                    <div class="item-titulo">{{ v.marca }} {{ v.modelo }} {{ v.anio ?? '' }}</div>
                    <div class="item-sub">{{ v.kilometraje }} km · {{ v.color || 'sin color' }}</div>
                  </div>
                  <span class="placa">{{ v.placa }}</span>
                </a>
              </li>
            } @empty {
              <li class="vacio">Este cliente aún no tiene vehículos registrados.</li>
            }
          </ul>
        </section>

        <!-- RN-04: solo el administrador desactiva o elimina; con vehículos solo se puede desactivar -->
        @if (auth.tieneRol('ADMIN')) {
          <div class="acciones">
            <button class="btn btn-sec" (click)="cambiarEstado(c)" [disabled]="procesando()">
              {{ c.activo ? 'Desactivar cliente' : 'Reactivar cliente' }}
            </button>
            @if (!c.vehiculos?.length) {
              <button class="btn btn-peligro" (click)="eliminar(c)" [disabled]="procesando()">
                Eliminar
              </button>
            }
          </div>
        }
      } @else if (!error()) {
        <p class="vacio">Cargando…</p>
      }
    </div>
  `,
})
export class ClienteDetalleComponent implements OnInit {
  private readonly api = inject(ClientesApi);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  readonly cliente = signal<Cliente | null>(null);
  readonly error = signal<string | null>(null);
  readonly procesando = signal(false);

  ngOnInit() {
    this.api.obtener(this.id()).subscribe({
      next: (c) => this.cliente.set(c),
      error: (err) => this.error.set(mensajeError(err)),
    });
  }

  cambiarEstado(c: Cliente) {
    this.procesando.set(true);
    this.api.actualizar(c.id, { activo: !c.activo }).subscribe({
      next: (actualizado) => {
        this.cliente.set(actualizado);
        this.procesando.set(false);
      },
      error: (err) => {
        this.error.set(mensajeError(err));
        this.procesando.set(false);
      },
    });
  }

  eliminar(c: Cliente) {
    if (!confirm(`¿Eliminar definitivamente a ${c.nombre}?`)) return;
    this.procesando.set(true);
    this.api.eliminar(c.id).subscribe({
      next: () => this.router.navigate(['/clientes']),
      error: (err) => {
        this.error.set(mensajeError(err));
        this.procesando.set(false);
      },
    });
  }
}
