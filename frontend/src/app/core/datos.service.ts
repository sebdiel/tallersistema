import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { FiltroOrdenes, OrdenesApi, RepuestosApi, VehiculosApi } from './api.service';
import { AuthService } from './auth.service';
import { ConexionService, esSinConexion } from './conexion.service';
import { OperacionPendiente, db } from './db';
import {
  ESTADOS_ABIERTOS,
  ESTADOS_CON_REPUESTOS,
  validarTransicion,
} from './estados';
import {
  Cliente,
  EstadoOrden,
  OrdenRepuesto,
  OrdenTrabajo,
  Repuesto,
  Vehiculo,
  formatoNumero,
} from './models';
import { SyncService } from './sync.service';

type Operacion = Omit<OperacionPendiente, 'creadaEn' | 'usuarioId'>;

export interface NuevaOrden {
  /** Vehículo ya registrado... */
  vehiculoId?: string;
  /** ...o datos de uno nuevo (recepción rápida, funciona sin conexión). */
  nuevoVehiculo?: { placa: string; marca: string; modelo: string; anio?: number | null; clienteId?: string };
  nuevoCliente?: { nombre: string; telefono: string; ciNit?: string | null };
  problemaReportado: string;
  kilometrajeIngreso: number;
  observacionesRecepcion?: string | null;
  mecanicoId?: string | null;
}

const uuid = () => crypto.randomUUID();
const normalizarPlaca = (p: string) => p.toUpperCase().replace(/[\s-]/g, '');
const ahora = () => new Date().toISOString();

/**
 * Acceso a datos con soporte offline (Local-First) para órdenes de trabajo,
 * vehículos y repuestos (HU-15).
 *
 * Lecturas: con conexión y sin cambios pendientes se lee del servidor y se
 * guarda copia en IndexedDB; en otro caso se lee la copia local.
 *
 * Escrituras: se validan las reglas en el dispositivo, se aplica el cambio en
 * la copia local, se encola la operación y, si hay conexión, se sincroniza al
 * instante. Si el servidor rechaza la operación se informa de inmediato.
 */
@Injectable({ providedIn: 'root' })
export class DatosService {
  private readonly ordenesApi = inject(OrdenesApi);
  private readonly vehiculosApi = inject(VehiculosApi);
  private readonly repuestosApi = inject(RepuestosApi);
  private readonly sync = inject(SyncService);
  private readonly conexion = inject(ConexionService);
  private readonly auth = inject(AuthService);

  // ================================================================ lecturas

  listarOrdenes(f: FiltroOrdenes = {}): Promise<OrdenTrabajo[]> {
    return this.leer(
      () => this.ordenesApi.listar(f),
      (lista) => this.guardarOrdenes(lista),
      async () => {
        const q = f.q?.trim().toLowerCase() ?? '';
        const placa = normalizarPlaca(q);
        return (await db.ordenes.toArray())
          .filter((o) => !f.estado || o.estado === f.estado)
          .filter((o) => !f.abiertas || ESTADOS_ABIERTOS.includes(o.estado))
          .filter(
            (o) =>
              !q ||
              o.vehiculo?.placa.includes(placa) ||
              o.cliente?.nombre.toLowerCase().includes(q) ||
              formatoNumero(o.numero).toLowerCase().includes(q),
          )
          .sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso));
      },
    );
  }

  obtenerOrden(id: string): Promise<OrdenTrabajo> {
    return this.leer(
      () => this.ordenesApi.obtener(id),
      (o) => this.guardarOrdenes([o]),
      async () => {
        const o = await db.ordenes.get(id);
        if (!o) throw new Error('Esta orden no está disponible sin conexión');
        return o;
      },
    );
  }

  buscarVehiculos(q = ''): Promise<Vehiculo[]> {
    return this.leer(
      () => this.vehiculosApi.buscar(q),
      (lista) => db.vehiculos.bulkPut(lista),
      async () => {
        const placa = normalizarPlaca(q);
        const texto = q.trim().toLowerCase();
        const clientes = new Map((await db.clientes.toArray()).map((c) => [c.id, c]));
        return (await db.vehiculos.orderBy('placa').toArray())
          .filter(
            (v) =>
              !texto ||
              v.placa.includes(placa) ||
              v.marca.toLowerCase().includes(texto) ||
              v.modelo.toLowerCase().includes(texto),
          )
          .slice(0, 50)
          .map((v) => ({ ...v, cliente: v.cliente ?? clientes.get(v.clienteId) }));
      },
    );
  }

  buscarClientes(q = ''): Promise<Cliente[]> {
    const texto = q.trim().toLowerCase();
    return db.clientes
      .orderBy('nombre')
      .filter((c) => c.activo && (!texto || c.nombre.toLowerCase().includes(texto) || c.telefono.includes(texto)))
      .limit(50)
      .toArray();
  }

  buscarRepuestos(q = '', bajoStock = false): Promise<Repuesto[]> {
    return this.leer(
      () => this.repuestosApi.buscar(q, bajoStock),
      (lista) => db.repuestos.bulkPut(lista),
      async () => {
        const texto = q.trim().toLowerCase();
        return (await db.repuestos.orderBy('nombre').toArray()).filter(
          (r) =>
            r.activo &&
            (!bajoStock || r.stock <= r.stockMinimo) &&
            (!texto ||
              r.codigo.toLowerCase().includes(texto) ||
              r.nombre.toLowerCase().includes(texto) ||
              (r.marca ?? '').toLowerCase().includes(texto)),
        );
      },
    );
  }

  /** Personal activo del taller (para asignar mecánico). */
  async personal() {
    return db.personal.toArray();
  }

  async resumenOrdenes(): Promise<Record<string, number>> {
    const abiertas = await this.listarOrdenes({ abiertas: true });
    return Object.fromEntries(
      ESTADOS_ABIERTOS.map((e) => [e, abiertas.filter((o) => o.estado === e).length]),
    );
  }

  // ============================================================== escrituras

  /** HU-09 / HU-15: recibir un vehículo (con o sin conexión). */
  async crearOrden(d: NuevaOrden): Promise<OrdenTrabajo> {
    const ops: Operacion[] = [];
    let cliente: Cliente | undefined;
    let vehiculo: Vehiculo | undefined;

    if (d.problemaReportado.trim().length < 5) {
      throw new Error('Describa el problema reportado (mínimo 5 caracteres)');
    }

    if (d.nuevoCliente) {
      cliente = {
        id: uuid(),
        nombre: d.nuevoCliente.nombre.trim(),
        telefono: d.nuevoCliente.telefono.trim(),
        ciNit: d.nuevoCliente.ciNit?.trim() || null,
        email: null,
        direccion: null,
        activo: true,
      };
      ops.push({
        id: uuid(),
        tipo: 'cliente.crear',
        datos: { id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono, ciNit: cliente.ciNit },
        descripcion: `Registrar cliente ${cliente.nombre}`,
      });
    }

    if (d.nuevoVehiculo) {
      const placa = normalizarPlaca(d.nuevoVehiculo.placa);
      if (await db.vehiculos.where('placa').equals(placa).count()) {
        throw new Error('La placa ya está registrada');
      }
      const clienteId = cliente?.id ?? d.nuevoVehiculo.clienteId;
      if (!clienteId) throw new Error('Indique el propietario del vehículo');
      cliente ??= await db.clientes.get(clienteId);
      vehiculo = {
        id: uuid(),
        clienteId,
        placa,
        marca: d.nuevoVehiculo.marca.trim(),
        modelo: d.nuevoVehiculo.modelo.trim(),
        anio: d.nuevoVehiculo.anio ?? null,
        color: null,
        nroChasis: null,
        combustible: null,
        kilometraje: d.kilometrajeIngreso,
        observaciones: null,
      };
      ops.push({
        id: uuid(),
        tipo: 'vehiculo.crear',
        datos: {
          id: vehiculo.id,
          clienteId,
          placa,
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          anio: vehiculo.anio,
          kilometraje: d.kilometrajeIngreso,
        },
        descripcion: `Registrar vehículo ${placa}`,
      });
    } else {
      vehiculo = (await db.vehiculos.get(d.vehiculoId!)) ?? undefined;
      if (!vehiculo) throw new Error('Seleccione un vehículo');
      cliente = (await db.clientes.get(vehiculo.clienteId)) ?? vehiculo.cliente;
      // RN-07
      if (d.kilometrajeIngreso < vehiculo.kilometraje) {
        throw new Error(
          `El kilometraje no puede ser menor al último registrado (${vehiculo.kilometraje} km)`,
        );
      }
      // RN-06
      const abierta = (await db.ordenes.where('vehiculoId').equals(vehiculo.id).toArray()).find(
        (o) => ESTADOS_ABIERTOS.includes(o.estado),
      );
      if (abierta) {
        throw new Error(
          `El vehículo ${vehiculo.placa} ya tiene la orden ${formatoNumero(abierta.numero)} abierta`,
        );
      }
    }

    const mecanico = d.mecanicoId ? await db.personal.get(d.mecanicoId) : null;
    const fecha = ahora();
    const orden: OrdenTrabajo = {
      id: uuid(),
      numero: null,
      vehiculoId: vehiculo.id,
      clienteId: vehiculo.clienteId,
      mecanicoId: d.mecanicoId ?? null,
      estado: 'RECIBIDO',
      problemaReportado: d.problemaReportado.trim(),
      observacionesRecepcion: d.observacionesRecepcion?.trim() || null,
      diagnostico: null,
      kilometrajeIngreso: d.kilometrajeIngreso,
      sinRepuestos: false,
      fechaIngreso: fecha,
      fechaTerminado: null,
      fechaEntrega: null,
      vehiculo: { ...vehiculo, kilometraje: d.kilometrajeIngreso },
      cliente,
      mecanico,
      repuestos: [],
      historial: [this.entradaHistorial(null, 'RECIBIDO', 'Vehículo recibido', fecha)],
      _pendiente: true,
    };
    ops.push({
      id: uuid(),
      tipo: 'orden.crear',
      datos: {
        id: orden.id,
        vehiculoId: vehiculo.id,
        problemaReportado: orden.problemaReportado,
        kilometrajeIngreso: d.kilometrajeIngreso,
        observacionesRecepcion: orden.observacionesRecepcion,
        mecanicoId: orden.mecanicoId,
        fechaIngreso: fecha,
      },
      descripcion: `Recibir ${vehiculo.placa}`,
    });

    return this.ejecutar(ops, orden.id, [], async () => {
      if (cliente && d.nuevoCliente) await db.clientes.put(cliente);
      await db.vehiculos.put({ ...vehiculo!, kilometraje: d.kilometrajeIngreso });
      await db.ordenes.put(orden);
    });
  }

  /** HU-10: cambio de estado según la máquina de estados. */
  async cambiarEstado(o: OrdenTrabajo, destino: EstadoOrden, comentario?: string | null) {
    const orden = structuredClone(o);
    const usuario = this.auth.usuario()!;

    if (destino === 'EN_DIAGNOSTICO' && !orden.mecanicoId && usuario.rol === 'MECANICO') {
      orden.mecanicoId = usuario.id;
      orden.mecanico = { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol };
    }
    this.verificarPermiso(orden);
    const error = validarTransicion(
      { ...orden, totalRepuestos: orden.repuestos?.length ?? 0 },
      destino,
      comentario,
    );
    if (error) throw new Error(error);

    const fecha = ahora();
    const devueltos = destino === 'CANCELADO' ? (orden.repuestos ?? []) : [];
    orden.historial = [
      ...(orden.historial ?? []),
      this.entradaHistorial(orden.estado, destino, comentario ?? null, fecha),
    ];
    orden.estado = destino;
    if (destino === 'TERMINADO') orden.fechaTerminado = fecha;
    if (destino === 'EN_REPARACION') orden.fechaTerminado = null;
    if (destino === 'ENTREGADO') orden.fechaEntrega = fecha;
    if (destino === 'CANCELADO') orden.repuestos = [];
    orden._pendiente = true;

    return this.ejecutar(
      [
        {
          id: uuid(),
          tipo: 'orden.estado',
          ref: orden.id,
          datos: { estado: destino, comentario: comentario ?? null, fecha },
          descripcion: `${formatoNumero(orden.numero)} → ${destino}`,
        },
      ],
      orden.id,
      devueltos.map((l) => l.repuestoId),
      async () => {
        // RN-14: al cancelar, los repuestos vuelven al stock local.
        for (const l of devueltos) await this.moverStockLocal(l.repuestoId, l.cantidad);
        await db.ordenes.put(orden);
      },
    );
  }

  async actualizarOrden(
    o: OrdenTrabajo,
    cambios: { diagnostico?: string | null; sinRepuestos?: boolean; observacionesRecepcion?: string | null },
  ) {
    this.verificarPermiso(o);
    if (!['RECIBIDO', ...ESTADOS_CON_REPUESTOS].includes(o.estado)) {
      throw new Error('La orden ya no se puede modificar');
    }
    if (cambios.sinRepuestos !== undefined && !ESTADOS_CON_REPUESTOS.includes(o.estado)) {
      throw new Error('Primero inicie el diagnóstico');
    }
    if (cambios.sinRepuestos && (o.repuestos?.length ?? 0) > 0) {
      throw new Error('La orden ya tiene repuestos registrados');
    }
    const orden = { ...structuredClone(o), ...cambios, _pendiente: true };
    return this.ejecutar(
      [
        {
          id: uuid(),
          tipo: 'orden.actualizar',
          ref: o.id,
          datos: cambios,
          descripcion: `Actualizar ${formatoNumero(o.numero)}`,
        },
      ],
      o.id,
      [],
      () => db.ordenes.put(orden),
    );
  }

  /** HU-11 (solo administrador). */
  async asignarMecanico(o: OrdenTrabajo, mecanicoId: string | null) {
    if (!ESTADOS_ABIERTOS.includes(o.estado)) throw new Error('La orden está cerrada');
    if (!mecanicoId && o.estado !== 'RECIBIDO') {
      throw new Error('Una orden en curso debe tener un mecánico asignado');
    }
    const mecanico = mecanicoId ? ((await db.personal.get(mecanicoId)) ?? null) : null;
    const orden = { ...structuredClone(o), mecanicoId, mecanico, _pendiente: true };
    return this.ejecutar(
      [
        {
          id: uuid(),
          tipo: 'orden.mecanico',
          ref: o.id,
          datos: { mecanicoId },
          descripcion: `Asignar mecánico a ${formatoNumero(o.numero)}`,
        },
      ],
      o.id,
      [],
      () => db.ordenes.put(orden),
    );
  }

  /** HU-13 / RN-10: agregar repuesto descuenta stock (también sin conexión). */
  async agregarRepuesto(o: OrdenTrabajo, repuestoId: string, cantidad: number) {
    this.verificarPermiso(o);
    this.verificarEstadoRepuestos(o);
    if (!(cantidad > 0)) throw new Error('La cantidad debe ser mayor a 0');

    const repuesto = await db.repuestos.get(repuestoId);
    if (!repuesto) throw new Error('El repuesto no existe');
    if (repuesto.stock < cantidad) {
      throw new Error(
        `Stock insuficiente de "${repuesto.nombre}": disponible ${repuesto.stock} ${repuesto.unidad.toLowerCase()}`,
      );
    }

    const linea: OrdenRepuesto = {
      id: uuid(),
      repuestoId,
      cantidad,
      precioUnitario: repuesto.precioVenta,
      repuesto: { ...repuesto, stock: repuesto.stock - cantidad },
    };
    const orden = structuredClone(o);
    orden.repuestos = [...(orden.repuestos ?? []), linea];
    orden.sinRepuestos = false;
    orden._pendiente = true;

    return this.ejecutar(
      [
        {
          id: uuid(),
          tipo: 'orden.repuesto.agregar',
          ref: o.id,
          datos: { id: linea.id, repuestoId, cantidad },
          descripcion: `${cantidad} × ${repuesto.nombre} en ${formatoNumero(o.numero)}`,
        },
      ],
      o.id,
      [repuestoId],
      async () => {
        await this.moverStockLocal(repuestoId, -cantidad);
        await db.ordenes.put(orden);
      },
    );
  }

  async quitarRepuesto(o: OrdenTrabajo, linea: OrdenRepuesto) {
    this.verificarPermiso(o);
    this.verificarEstadoRepuestos(o);
    const orden = structuredClone(o);
    orden.repuestos = (orden.repuestos ?? []).filter((l) => l.id !== linea.id);
    orden._pendiente = true;

    return this.ejecutar(
      [
        {
          id: uuid(),
          tipo: 'orden.repuesto.quitar',
          ref: o.id,
          datos: { lineaId: linea.id },
          descripcion: `Quitar ${linea.repuesto?.nombre ?? 'repuesto'} de ${formatoNumero(o.numero)}`,
        },
      ],
      o.id,
      [linea.repuestoId],
      async () => {
        await this.moverStockLocal(linea.repuestoId, linea.cantidad);
        await db.ordenes.put(orden);
      },
    );
  }

  // ============================================================ auxiliares

  /**
   * Encola, aplica localmente y, si hay conexión, sincroniza enseguida.
   * Devuelve la orden tal como quedó (del servidor si se pudo confirmar).
   */
  private async ejecutar(
    ops: Operacion[],
    ordenId: string,
    repuestoIds: string[],
    aplicarLocal: () => Promise<unknown>,
  ): Promise<OrdenTrabajo> {
    await this.sync.encolar(ops);
    await aplicarLocal();

    if (this.conexion.enLinea()) {
      const resultados = await this.sync.sincronizar();
      const fallo = ops.map((op) => resultados.get(op.id)).find((r) => r && !r.ok && !r.reintentar);

      if (fallo) {
        // El usuario está en la pantalla: se le informa ya en vez de dejar un conflicto.
        for (const op of ops) await this.sync.descartarConflicto(op.id);
        if (!(await this.sync.hayPendientes())) await this.sync.descargarSnapshot().catch(() => {});
        throw new Error(fallo.error ?? 'El servidor rechazó la operación');
      }
      if (ops.every((op) => resultados.get(op.id)?.ok)) {
        await this.refrescar(ordenId, repuestoIds);
      }
    }
    return (await db.ordenes.get(ordenId))!;
  }

  /** Trae del servidor la versión confirmada de lo que se acaba de modificar. */
  private async refrescar(ordenId: string, repuestoIds: string[]) {
    if (await this.sync.hayPendientes()) return;
    try {
      const orden = await firstValueFrom(this.ordenesApi.obtener(ordenId));
      await this.guardarOrdenes([orden]);
      for (const id of new Set(repuestoIds)) {
        const { repuesto } = await firstValueFrom(this.repuestosApi.detalle(id));
        await db.repuestos.put(repuesto);
      }
    } catch (err) {
      if (!esSinConexion(err)) console.error(err);
    }
  }

  private async leer<T>(
    remoto: () => Observable<T>,
    guardar: (valor: T) => Promise<unknown>,
    local: () => Promise<T>,
  ): Promise<T> {
    // Con cambios pendientes, la copia local es la más actual.
    if (this.conexion.enLinea() && !(await this.sync.hayPendientes())) {
      try {
        const valor = await firstValueFrom(remoto());
        await guardar(valor);
        return valor;
      } catch (err) {
        if (!esSinConexion(err)) throw err;
      }
    }
    return local();
  }

  /** Guarda órdenes del servidor sin perder el historial ya cacheado. */
  private async guardarOrdenes(ordenes: OrdenTrabajo[]) {
    const previas = await db.ordenes.bulkGet(ordenes.map((o) => o.id));
    await db.ordenes.bulkPut(
      ordenes.map((o, i) => ({ ...o, historial: o.historial ?? previas[i]?.historial, _pendiente: false })),
    );
    const vehiculos = ordenes.filter((o) => o.vehiculo).map((o) => o.vehiculo!);
    const clientes = ordenes.filter((o) => o.cliente).map((o) => o.cliente!);
    await db.vehiculos.bulkPut(vehiculos);
    await db.clientes.bulkPut(clientes);
  }

  private async moverStockLocal(repuestoId: string, cantidad: number) {
    await db.repuestos.where('id').equals(repuestoId).modify((r) => {
      r.stock = Math.round((r.stock + cantidad) * 100) / 100;
    });
  }

  private entradaHistorial(
    anterior: EstadoOrden | null,
    nuevo: EstadoOrden,
    comentario: string | null,
    fecha: string,
  ) {
    const u = this.auth.usuario()!;
    return {
      estadoAnterior: anterior,
      estadoNuevo: nuevo,
      comentario,
      fecha,
      usuario: { id: u.id, nombre: u.nombre },
    };
  }

  private verificarPermiso(o: OrdenTrabajo) {
    const u = this.auth.usuario()!;
    if (u.rol === 'MECANICO' && o.mecanicoId && o.mecanicoId !== u.id) {
      throw new Error('Esta orden está asignada a otro mecánico');
    }
  }

  private verificarEstadoRepuestos(o: OrdenTrabajo) {
    if (!ESTADOS_CON_REPUESTOS.includes(o.estado)) {
      throw new Error('Solo se pueden registrar repuestos durante el diagnóstico o la reparación');
    }
  }
}
