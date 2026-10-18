import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { DatosService } from '../../core/datos.service';
import {
  ACCION_ESTADO,
  ESTADOS_CON_REPUESTOS,
  ESTADO_INFO,
  TRANSICIONES,
} from '../../core/estados';
import {
  EstadoOrden,
  OrdenRepuesto,
  OrdenTrabajo,
  Persona,
  Repuesto,
  formatoNumero,
} from '../../core/models';

/** HU-10, HU-11, HU-13: seguimiento completo de la orden de trabajo. */
@Component({
  selector: 'app-orden-detalle',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './orden-detalle.component.html',
  styles: `
    .cabecera-ot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .acciones-estado {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .agregar {
      display: grid;
      grid-template-columns: 1fr 90px auto;
      gap: 8px;
      align-items: end;
    }
    textarea {
      width: 100%;
    }
  `,
})
export class OrdenDetalleComponent implements OnInit {
  private readonly datos = inject(DatosService);
  readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  readonly info = ESTADO_INFO;
  readonly accionTexto = ACCION_ESTADO;
  readonly numero = formatoNumero;

  readonly orden = signal<OrdenTrabajo | null>(null);
  readonly personal = signal<Persona[]>([]);
  readonly repuestos = signal<Repuesto[]>([]);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly procesando = signal(false);

  /** Transición que requiere comentario (cancelar / reabrir) a la espera de confirmar. */
  readonly confirmando = signal<EstadoOrden | null>(null);
  comentario = '';
  diagnostico = '';
  repuestoId = '';
  cantidad = 1;
  filtroRepuesto = '';

  readonly siguientes = computed(() => {
    const o = this.orden();
    return o ? TRANSICIONES[o.estado] : [];
  });
  readonly editable = computed(() => {
    const e = this.orden()?.estado;
    return e === 'RECIBIDO' || (!!e && ESTADOS_CON_REPUESTOS.includes(e));
  });
  readonly conRepuestos = computed(() => {
    const e = this.orden()?.estado;
    return !!e && ESTADOS_CON_REPUESTOS.includes(e);
  });
  readonly totalRepuestos = computed(() =>
    (this.orden()?.repuestos ?? []).reduce((s, l) => s + l.cantidad * l.precioUnitario, 0),
  );
  repuestoElegido() {
    return this.repuestos().find((r) => r.id === this.repuestoId);
  }

  async ngOnInit() {
    try {
      this.mostrar(await this.datos.obtenerOrden(this.id()));
      this.personal.set(await this.datos.personal());
      this.repuestos.set(await this.datos.buscarRepuestos());
    } catch (err) {
      this.error.set(mensajeError(err));
    }
  }

  // ---------------------------------------------------------------- acciones

  cambiarEstado(destino: EstadoOrden) {
    const o = this.orden()!;
    const requiereMotivo =
      destino === 'CANCELADO' || (o.estado === 'TERMINADO' && destino === 'EN_REPARACION');
    if (requiereMotivo && this.confirmando() !== destino) {
      this.confirmando.set(destino);
      this.comentario = '';
      return;
    }
    this.ejecutar(() => this.datos.cambiarEstado(o, destino, this.comentario || null)).then(() =>
      this.confirmando.set(null),
    );
  }

  guardarDiagnostico() {
    this.ejecutar(() =>
      this.datos.actualizarOrden(this.orden()!, { diagnostico: this.diagnostico.trim() || null }),
    );
  }

  marcarSinRepuestos(valor: boolean) {
    this.ejecutar(() => this.datos.actualizarOrden(this.orden()!, { sinRepuestos: valor }));
  }

  asignar(mecanicoId: string) {
    this.ejecutar(() => this.datos.asignarMecanico(this.orden()!, mecanicoId || null));
  }

  async agregarRepuesto() {
    if (!this.repuestoId) return this.error.set('Seleccione un repuesto');
    await this.ejecutar(() =>
      this.datos.agregarRepuesto(this.orden()!, this.repuestoId, Number(this.cantidad)),
    );
    this.repuestoId = '';
    this.cantidad = 1;
  }

  quitar(linea: OrdenRepuesto) {
    if (!confirm(`¿Quitar ${linea.repuesto?.nombre}? Volverá al inventario.`)) return;
    this.ejecutar(() => this.datos.quitarRepuesto(this.orden()!, linea));
  }

  async filtrarRepuestos() {
    this.repuestos.set(await this.datos.buscarRepuestos(this.filtroRepuesto));
  }

  // ---------------------------------------------------------------- auxiliares

  private async ejecutar(accion: () => Promise<OrdenTrabajo>) {
    this.procesando.set(true);
    this.error.set(null);
    this.aviso.set(null);
    try {
      const orden = await accion();
      this.mostrar(orden);
      if (orden._pendiente) {
        this.aviso.set('Guardado en el dispositivo. Se enviará al servidor cuando haya conexión.');
      }
      // Stock actualizado para el selector de repuestos.
      this.repuestos.set(await this.datos.buscarRepuestos(this.filtroRepuesto));
    } catch (err) {
      this.error.set(mensajeError(err));
      // Recargar por si el servidor tenía una versión distinta.
      this.datos.obtenerOrden(this.id()).then((o) => this.mostrar(o)).catch(() => {});
    } finally {
      this.procesando.set(false);
    }
  }

  private mostrar(o: OrdenTrabajo) {
    this.orden.set(o);
    this.diagnostico = o.diagnostico ?? '';
  }
}
