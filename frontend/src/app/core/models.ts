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
  /** Se llena con órdenes de trabajo en la Iteración 2. */
  historial: unknown[];
}

export const COMBUSTIBLES = ['GASOLINA', 'DIESEL', 'GNV', 'ELECTRICO', 'HIBRIDO'];
