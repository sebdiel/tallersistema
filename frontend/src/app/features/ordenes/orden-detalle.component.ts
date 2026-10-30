import { IconoComponent } from '../../layout/icono.component';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { DatosService } from '../../core/datos.service';
import { calcularTotales } from '../../core/costos';
import {
  ACCION_ESTADO,
  ESTADOS_ABIERTOS,
  ESTADOS_CON_REPUESTOS,
  ESTADO_INFO,
  TRANSICIONES,
} from '../../core/estados';
import {
  EstadoOrden,
  METODOS_PAGO,
  ManoObra,
  MetodoPago,
  OrdenRepuesto,
  OrdenTrabajo,
  Pago,
  Persona,
  Repuesto,
  RepuestoExterno,
  RepuestoSugerido,
  Servicio,
  formatoNumero,
} from '../../core/models';

/** HU-10, HU-11, HU-13: seguimiento completo de la orden de trabajo. */
@Component({
  selector: 'app-orden-detalle',
  standalone: true,
  imports: [IconoComponent, RouterLink, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './orden-detalle.component.html',
  styles: `
    .btn-icono { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px;
      margin-left: 4px; border-radius: 8px; border: 1px solid var(--borde); background: transparent;
      color: var(--texto-suave); font-size: 1.05rem; cursor: pointer; transition: all 0.15s; }
    .btn-icono:hover:not(:disabled) { color: #f5b301; border-color: #f5b301; background: #f5b30114; }
    .btn-icono.peligro:hover:not(:disabled) { color: #ef4444; border-color: #ef4444; background: #ef444414; }
    .btn-icono:disabled { opacity: 0.4; cursor: default; }
    td.num:has(.btn-icono) { white-space: nowrap; }
    .fecha-entrega { width: auto; min-height: 34px; padding: 2px 8px; }
    .atrasada { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px;
      background: #ef444422; color: #ef4444; font-size: 0.75rem; font-weight: 700; }
    .sugeridos { margin-top: 12px; padding: 10px 12px; border: 1px dashed #f5b301; border-radius: 10px; background: #f5b3010d; }
    .sugerido { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
    .rep-libre { margin-top: 10px; padding: 10px 12px; border: 1px dashed #f5b301; border-radius: 10px; background: #f5b3010d; }
    .rep-libre-fila { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-top: 8px; }
    .rep-libre-fila label { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: var(--texto-suave); }
    .rep-libre-fila input { width: 130px; }
    .editor { margin-top: 12px; padding: 12px; border: 1px dashed #f5b301; border-radius: 10px; }
    .cambio { color: #f5b301; }
    .diferencia { color: #16a34a; }
    .diferencia.sube { color: #d97706; }
    .origen { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }
    .origen.cliente { background: #2563eb22; color: #60a5fa; }
    .origen.taller { background: #f5b30122; color: #f5b301; }
    .pasos { display: flex; gap: 4px; margin-bottom: 16px; overflow-x: auto; }
    .paso { flex: 1; min-width: 90px; text-align: center; font-size: 0.8rem; color: var(--texto-suave);
      padding-top: 8px; border-top: 4px solid var(--borde); }
    .paso.hecho { border-top-color: #a37a00; color: var(--texto); }
    .paso.actual { border-top-color: #f5b301; color: #f5b301; font-weight: 700; }
    .paso b { display: block; font-size: 0.95rem; }
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
    .descuento {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .descuento input {
      width: 90px;
      min-height: 36px;
      padding: 4px 8px;
      border: 1px solid var(--borde);
      border-radius: 6px;
      font: inherit;
    }
    .descuento button {
      min-height: 34px;
      padding: 0 10px;
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
  readonly servicios = signal<Servicio[]>([]);
  readonly metodos = METODOS_PAGO;
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
  libre = { precio: null as number | null, cantidad: 1 };
  // Iteración 3
  mo = { servicioId: '', descripcion: '', monto: null as number | null };
  ext = { descripcion: '', cantidad: 1, origen: 'CLIENTE' as 'CLIENTE' | 'TALLER', costo: null as number | null, precio: null as number | null };
  descuento: number | null = null;
  pago = { monto: null as number | null, metodo: 'EFECTIVO' as MetodoPago, referencia: '' };
  readonly anulando = signal<Pago | null>(null);
  /** RN-29: línea de costo que se está corrigiendo. */
  readonly editando = signal<{ tipo: 'ext' | 'mo'; id: string; delCliente: boolean } | null>(null);
  ed = { descripcion: '', cantidad: 1, precio: 0, costo: null as number | null, motivo: '' };
  motivoAnulacion = '';

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
  readonly totales = computed(() => {
    const o = this.orden();
    return o ? (o.totales ?? calcularTotales(o)) : null;
  });
  readonly costosEditables = computed(() => {
    const e = this.orden()?.estado;
    return !!e && ESTADOS_ABIERTOS.includes(e);
  });

  /** La página muestra solo lo que corresponde al paso actual de la orden. */
  readonly pasos = ['Recibido', 'Diagnóstico', 'Reparación', 'Terminado', 'Entregado'];
  readonly pasoActual = computed(() =>
    ['RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO', 'ENTREGADO'].indexOf(this.orden()?.estado ?? ''),
  );
  /** Diagnóstico, repuestos y mano de obra: se trabajan en diagnóstico y reparación. */
  readonly enTrabajo = computed(() => this.pasoActual() === 1 || this.pasoActual() === 2);
  /** En diagnóstico se arma el precio: sin cobros (salvo que ya existan pagos). */
  readonly presupuestando = computed(() => this.orden()?.estado === 'EN_DIAGNOSTICO' && !this.orden()?.pagos?.length);
  /** Ya pasó la etapa de trabajo (terminado, entregado o cancelado con costos). */
  readonly despuesTrabajo = computed(() => !this.enTrabajo() && this.orden()?.estado !== 'RECIBIDO');
  repuestoElegido() {
    return this.repuestos().find((r) => r.id === this.repuestoId);
  }

  async ngOnInit() {
    try {
      this.mostrar(await this.datos.obtenerOrden(this.id()));
      this.personal.set(await this.datos.personal());
      this.repuestos.set(await this.datos.buscarRepuestos());
      this.servicios.set(await this.datos.servicios());
    } catch (err) {
      this.error.set(mensajeError(err));
    }
  }

  // ---------------------------------------------------------------- acciones

  /** Pasos hacia atrás (reabrir reparación, volver a diagnóstico): piden motivo. */
  esRetroceso(destino: EstadoOrden) {
    const e = this.orden()?.estado;
    return (e === 'TERMINADO' && destino === 'EN_REPARACION') || (e === 'EN_REPARACION' && destino === 'EN_DIAGNOSTICO');
  }

  cambiarEstado(destino: EstadoOrden) {
    const o = this.orden()!;
    const requiereMotivo =
      destino === 'CANCELADO' ||
      this.esRetroceso(destino) ||
      // RN-18: entregar a crédito (solo admin) exige comentario.
      (destino === 'ENTREGADO' && (this.totales()?.saldo ?? 0) > 0 && this.auth.tieneRol('ADMIN'));
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

  /** RN-28: repuesto que no está en el inventario; queda como repuesto externo del taller. */
  async agregarRepuestoLibre() {
    await this.ejecutar(() =>
      this.datos.agregarRepuestoExterno(this.orden()!, {
        descripcion: this.filtroRepuesto.trim(),
        cantidad: Number(this.libre.cantidad) || 1,
        origen: 'TALLER',
        precioUnitario: Number(this.libre.precio),
      }),
    );
    if (!this.error()) {
      this.filtroRepuesto = '';
      this.libre = { precio: null, cantidad: 1 };
      this.filtrarRepuestos();
    }
  }

  async filtrarRepuestos() {
    this.repuestos.set(await this.datos.buscarRepuestos(this.filtroRepuesto));
  }

  // ------------------------------------------------------ costos y pagos

  elegirServicio(id: string) {
    const s = this.servicios().find((x) => x.id === id);
    this.mo = { servicioId: id, descripcion: s?.nombre ?? '', monto: s?.precio ?? null };
  }

  async agregarManoObra() {
    await this.ejecutar(() =>
      this.datos.agregarManoObra(this.orden()!, {
        servicioId: this.mo.servicioId || null,
        descripcion: this.mo.descripcion,
        monto: Number(this.mo.monto),
      }),
    );
    if (!this.error()) this.mo = { servicioId: '', descripcion: '', monto: null };
  }

  quitarManoObra(linea: ManoObra) {
    if (!confirm(`¿Quitar "${linea.descripcion}"?`)) return;
    this.ejecutar(() => this.datos.quitarManoObra(this.orden()!, linea));
  }

  async agregarExterno() {
    await this.ejecutar(() =>
      this.datos.agregarRepuestoExterno(this.orden()!, {
        descripcion: this.ext.descripcion,
        cantidad: Number(this.ext.cantidad),
        origen: this.ext.origen,
        costoUnitario: this.ext.costo == null ? null : Number(this.ext.costo),
        precioUnitario: this.ext.precio == null ? null : Number(this.ext.precio),
      }),
    );
    if (!this.error()) this.ext = { descripcion: '', cantidad: 1, origen: this.ext.origen, costo: null, precio: null };
  }

  quitarExterno(linea: RepuestoExterno) {
    if (!confirm(`¿Quitar "${linea.descripcion}"?`)) return;
    this.ejecutar(() => this.datos.quitarRepuestoExterno(this.orden()!, linea));
  }

  /** Después de aprobado el presupuesto, cambiar un precio exige explicar por qué. */
  readonly pideMotivo = computed(() => this.orden()?.presupuestoAprobado != null);

  editarExterno(l: RepuestoExterno) {
    this.editando.set({ tipo: 'ext', id: l.id, delCliente: l.origen === 'CLIENTE' });
    this.ed = { descripcion: l.descripcion, cantidad: l.cantidad, precio: l.precioUnitario, costo: l.costoUnitario, motivo: '' };
  }

  editarMano(l: ManoObra) {
    this.editando.set({ tipo: 'mo', id: l.id, delCliente: false });
    this.ed = { descripcion: l.descripcion, cantidad: 1, precio: l.monto, costo: null, motivo: '' };
  }

  async guardarEdicion() {
    const e = this.editando()!;
    const o = this.orden()!;
    if (this.pideMotivo() && this.ed.motivo.trim().length < 3) {
      return this.error.set('Explique por qué cambia el precio (el cliente ya aprobó el presupuesto)');
    }
    const motivo = this.ed.motivo.trim() || null;
    await this.ejecutar(() => {
      if (e.tipo === 'ext') {
        const linea = o.externos!.find((l) => l.id === e.id)!;
        return this.datos.editarRepuestoExterno(o, linea, {
          cantidad: Number(this.ed.cantidad),
          precioUnitario: Number(this.ed.precio),
          costoUnitario: this.ed.costo == null || String(this.ed.costo) === '' ? null : Number(this.ed.costo),
          motivo,
        });
      }
      const linea = o.manoObra!.find((l) => l.id === e.id)!;
      return this.datos.editarManoObra(o, linea, { descripcion: this.ed.descripcion, monto: Number(this.ed.precio), motivo });
    });
    if (!this.error()) this.editando.set(null);
  }

  /** RN-26: la fecha acordada ya pasó y el vehículo no se entregó. */
  readonly atrasada = computed(() => {
    const o = this.orden();
    if (!o?.fechaEntregaEstimada || !ESTADOS_ABIERTOS.includes(o.estado)) return false;
    const d = new Date();
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return o.fechaEntregaEstimada < hoy;
  });

  cambiarEntrega(fecha: string) {
    this.ejecutar(() => this.datos.actualizarOrden(this.orden()!, { fechaEntregaEstimada: fecha || null }));
  }

  /** RN-33: repuestos elegidos al recibir que todavía no se cargaron. */
  readonly sugeridosPendientes = computed(() => {
    const o = this.orden();
    const cargados = new Set((o?.repuestos ?? []).map((l) => l.repuestoId));
    return (o?.repuestosSugeridos ?? []).filter((s) => !cargados.has(s.repuestoId));
  });

  agregarSugerido(s: RepuestoSugerido) {
    this.ejecutar(() => this.datos.agregarRepuesto(this.orden()!, s.repuestoId, s.cantidad));
  }

  aplicarDescuento() {
    this.ejecutar(() => this.datos.aplicarDescuento(this.orden()!, Number(this.descuento ?? 0)));
  }

  async registrarPago() {
    await this.ejecutar(() =>
      this.datos.registrarPago(this.orden()!, {
        monto: Number(this.pago.monto),
        metodo: this.pago.metodo,
        referencia: this.pago.referencia,
      }),
    );
    if (!this.error()) this.pago = { monto: null, metodo: 'EFECTIVO', referencia: '' };
  }

  async confirmarAnulacion() {
    await this.ejecutar(() =>
      this.datos.anularPago(this.orden()!, this.anulando()!, this.motivoAnulacion),
    );
    if (!this.error()) {
      this.anulando.set(null);
      this.motivoAnulacion = '';
    }
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
    this.descuento = o.descuento ?? 0;
  }
}
