import Dexie, { Table } from 'dexie';
import { Cliente, OrdenTrabajo, Persona, Repuesto, Vehiculo } from './models';

/** Operación hecha en el dispositivo, pendiente de enviar al servidor. */
export interface OperacionPendiente {
  /** Id único: el servidor lo usa para no aplicar dos veces la misma operación. */
  id: string;
  tipo: string;
  /** Orden sobre la que actúa (operaciones orden.*). */
  ref?: string;
  datos: Record<string, unknown>;
  creadaEn: string;
  usuarioId: string;
  /** Texto legible para la pantalla de sincronización. */
  descripcion: string;
}

/** Operación que el servidor rechazó al sincronizar (p. ej. stock insuficiente). */
export interface Conflicto extends OperacionPendiente {
  error: string;
  detectadoEn: string;
}

/**
 * Base de datos local del navegador (IndexedDB) — enfoque Local-First.
 * Guarda una copia de los datos del taller para trabajar sin internet y la
 * cola de operaciones a sincronizar.
 */
export class TallerDb extends Dexie {
  clientes!: Table<Cliente, string>;
  vehiculos!: Table<Vehiculo, string>;
  repuestos!: Table<Repuesto, string>;
  ordenes!: Table<OrdenTrabajo, string>;
  personal!: Table<Persona, string>;
  cola!: Table<OperacionPendiente, string>;
  conflictos!: Table<Conflicto, string>;
  meta!: Table<{ clave: string; valor: string }, string>;

  constructor() {
    super('tallerpro');
    this.version(1).stores({
      clientes: 'id, nombre',
      vehiculos: 'id, placa, clienteId',
      repuestos: 'id, codigo, nombre',
      ordenes: 'id, estado, vehiculoId, fechaIngreso',
      personal: 'id',
      cola: 'id, creadaEn, usuarioId',
      conflictos: 'id',
      meta: 'clave',
    });
  }
}

export const db = new TallerDb();
