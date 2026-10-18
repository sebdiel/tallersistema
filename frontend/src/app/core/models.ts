export type Rol = 'SUPERADMIN' | 'ADMIN' | 'MECANICO';

export const ROL_LABEL: Record<Rol, string> = {
  SUPERADMIN: 'Super administrador',
  ADMIN: 'Administrador',
  MECANICO: 'Mecánico',
};

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  taller: { id: string; nombre: string } | null;
}

export interface LoginResponse {
  accessToken: string;
  usuario: UsuarioSesion;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  createdAt: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  ciNit: string | null;
  telefono: string;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  totalVehiculos?: number;
  vehiculos?: Vehiculo[];
}

export interface Vehiculo {
  id: string;
  clienteId: string;
  placa: string;
  marca: string;
  modelo: string;
  anio: number | null;
  color: string | null;
  nroChasis: string | null;
  combustible: string | null;
  kilometraje: number;
  observaciones: string | null;
  cliente?: Cliente;
}

export interface FichaVehiculo {
  vehiculo: Vehiculo;
  historial: OrdenTrabajo[];
}

export const COMBUSTIBLES = ['GASOLINA', 'DIESEL', 'GNV', 'ELECTRICO', 'HIBRIDO'];

// ---------------------------------------------------------------- Iteración 2

export type EstadoOrden =
  | 'RECIBIDO'
  | 'EN_DIAGNOSTICO'
  | 'EN_REPARACION'
  | 'TERMINADO'
  | 'ENTREGADO'
  | 'CANCELADO';

export const UNIDADES = ['UNIDAD', 'LITRO', 'JUEGO', 'KIT', 'METRO', 'KILO'];

export interface Repuesto {
  id: string;
  codigo: string;
  nombre: string;
  marca: string | null;
  unidad: string;
  stock: number;
  stockMinimo: number;
  precioCompra: number;
  precioVenta: number;
  ubicacion: string | null;
  activo: boolean;
}

export interface MovimientoInventario {
  id: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'DEVOLUCION' | 'AJUSTE';
  cantidad: number;
  stockResultante: number;
  ordenId: string | null;
  motivo: string | null;
  fecha: string;
  usuario: { id: string; nombre: string } | null;
}

export interface OrdenRepuesto {
  id: string;
  repuestoId: string;
  cantidad: number;
  precioUnitario: number;
  repuesto?: Repuesto;
}

export interface HistorialEstado {
  id?: string;
  estadoAnterior: EstadoOrden | null;
  estadoNuevo: EstadoOrden;
  comentario: string | null;
  fecha: string;
  usuario?: { id: string; nombre: string };
}

export interface Persona {
  id: string;
  nombre: string;
  rol: Rol;
}

export interface OrdenTrabajo {
  id: string;
  /** null mientras la OT creada sin conexión no llega al servidor. */
  numero: number | null;
  vehiculoId: string;
  clienteId: string;
  mecanicoId: string | null;
  estado: EstadoOrden;
  problemaReportado: string;
  observacionesRecepcion: string | null;
  diagnostico: string | null;
  kilometrajeIngreso: number;
  sinRepuestos: boolean;
  fechaIngreso: string;
  fechaTerminado: string | null;
  fechaEntrega: string | null;
  vehiculo?: Vehiculo;
  cliente?: Cliente;
  mecanico?: Persona | null;
  repuestos?: OrdenRepuesto[];
  historial?: HistorialEstado[];
  /** Tiene cambios hechos sin conexión aún no confirmados por el servidor. */
  _pendiente?: boolean;
}

export interface Alerta {
  id: string;
  tipo: 'STOCK_BAJO' | 'ORDEN_TERMINADA';
  mensaje: string;
  referenciaId: string;
  createdAt: string;
}

export interface Snapshot {
  generadoEn: string;
  clientes: Cliente[];
  vehiculos: Vehiculo[];
  repuestos: Repuesto[];
  ordenes: OrdenTrabajo[];
  personal: Persona[];
}

export const formatoNumero = (n: number | null) =>
  n == null ? 'OT pendiente' : `OT-${String(n).padStart(4, '0')}`;
