import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { ESTADO_SUSCRIPCION, TallerResumen } from '../../core/models';

/** Talleres clientes del sistema (SUPERADMIN). */
@Component({
  selector: 'app-admin-talleres',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Talleres</h1>
        <a class="btn" routerLink="/admin/talleres/nuevo">+ Nuevo taller</a>
      </div>

      <input class="buscador" type="search" placeholder="Buscar por nombre, contacto o correo…" [(ngModel)]="filtro" />

      @if (error()) {
        <div class="alerta alerta-error" style="margin-top: 12px">{{ error() }}</div>
      }

      <ul class="lista" style="margin-top: 12px">
        @for (t of visibles(); track t.id) {
          <li>
            <a class="item" [routerLink]="['/admin/talleres', t.id]">
              <div>
                <div class="item-titulo">{{ t.nombre }}</div>
                <div class="item-sub">{{ t.adminEmail }} @if (t.contactoNombre) { · {{ t.contactoNombre }} }</div>
                <div class="item-sub">
                  {{ t.usuarios }} usuario(s) · {{ t.ot30d }} OT en 30 días ·
                  última actividad: {{ t.ultimaActividad ? (t.ultimaActividad | date: 'dd/MM/yyyy') : 'sin uso' }}
                </div>
              </div>
              <div style="text-align: right">
                <span [class]="'estado-ot ' + info[t.suscripcion.estado].clase">{{ info[t.suscripcion.estado].texto }}</span>
                <div class="item-sub">hasta {{ t.suscripcion.vigenteHasta | date: 'dd/MM/yyyy' }}</div>
              </div>
            </a>
          </li>
        } @empty {
          <li class="vacio">{{ cargando() ? 'Cargando…' : 'No hay talleres.' }}</li>
        }
      </ul>
    </div>
  `,
})
export class AdminTalleresComponent implements OnInit {
  private readonly api = inject(AdminApi);
  readonly info = ESTADO_SUSCRIPCION;
  readonly talleres = signal<TallerResumen[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly filtroTexto = signal('');

  get filtro() {
    return this.filtroTexto();
  }
  set filtro(v: string) {
    this.filtroTexto.set(v);
  }

  readonly visibles = computed(() => {
    const q = this.filtroTexto().trim().toLowerCase();
    return this.talleres().filter(
      (t) =>
        !q ||
        t.nombre.toLowerCase().includes(q) ||
        (t.contactoNombre ?? '').toLowerCase().includes(q) ||
        (t.adminEmail ?? '').toLowerCase().includes(q),
    );
  });

  async ngOnInit() {
    try {
      this.talleres.set(await firstValueFrom(this.api.talleres()));
    } catch (err) {
      this.error.set(mensajeError(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
