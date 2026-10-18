import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from './config';
import {
  Alerta,
  Cliente,
  Dashboard,
  Servicio,
  Taller,
  EstadoOrden,
  FichaVehiculo,
  MovimientoInventario,
  OrdenTrabajo,
  Repuesto,
  Snapshot,
  Usuario,
  Vehiculo,
} from './models';

@Injectable({ providedIn: 'root' })
export class ClientesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/clientes`;

  buscar(q = '', inactivos = false) {
    const params = new HttpParams().set('q', q).set('inactivos', inactivos);
    return this.http.get<Cliente[]>(this.url, { params });
  }
  obtener(id: string) {
    return this.http.get<Cliente>(`${this.url}/${id}`);
  }
  crear(data: Partial<Cliente>) {
    return this.http.post<Cliente>(this.url, data);
  }
  actualizar(id: string, data: Partial<Cliente>) {
    return this.http.patch<Cliente>(`${this.url}/${id}`, data);
  }
  eliminar(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class VehiculosApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/vehiculos`;

  buscar(q = '') {
    return this.http.get<Vehiculo[]>(this.url, { params: { q } });
  }
  ficha(id: string) {
    return this.http.get<FichaVehiculo>(`${this.url}/${id}`);
  }
  crear(data: Partial<Vehiculo>) {
    return this.http.post<Vehiculo>(this.url, data);
  }
  actualizar(id: string, data: Partial<Vehiculo>) {
    return this.http.patch<Vehiculo>(`${this.url}/${id}`, data);
  }
}

@Injectable({ providedIn: 'root' })
export class UsuariosApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/usuarios`;

  listar() {
    return this.http.get<Usuario[]>(this.url);
  }
  crear(data: Partial<Usuario> & { password: string }) {
    return this.http.post<Usuario>(this.url, data);
  }
  actualizar(id: string, data: Partial<Usuario> & { password?: string }) {
    return this.http.patch<Usuario>(`${this.url}/${id}`, data);
  }
}

// ---------------------------------------------------------------- Iteración 2

@Injectable({ providedIn: 'root' })
export class RepuestosApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/repuestos`;

  buscar(q = '', bajoStock = false, inactivos = false) {
    return this.http.get<Repuesto[]>(this.url, { params: { q, bajoStock, inactivos } });
  }
  detalle(id: string) {
    return this.http.get<{ repuesto: Repuesto; movimientos: MovimientoInventario[] }>(
      `${this.url}/${id}`,
    );
  }
  crear(data: Partial<Repuesto>) {
    return this.http.post<Repuesto>(this.url, data);
  }
  actualizar(id: string, data: Partial<Repuesto>) {
    return this.http.patch<Repuesto>(`${this.url}/${id}`, data);
  }
  entrada(id: string, data: { cantidad: number; precioCompra?: number; motivo?: string }) {
    return this.http.post<Repuesto>(`${this.url}/${id}/entradas`, data);
  }
  ajuste(id: string, data: { stockReal: number; motivo: string }) {
    return this.http.post<Repuesto>(`${this.url}/${id}/ajustes`, data);
  }
}

export interface FiltroOrdenes {
  estado?: EstadoOrden;
  abiertas?: boolean;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class OrdenesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/ordenes`;

  listar(f: FiltroOrdenes = {}) {
    const params: Record<string, string | boolean> = {};
    if (f.estado) params['estado'] = f.estado;
    if (f.abiertas) params['abiertas'] = true;
    if (f.q) params['q'] = f.q;
    return this.http.get<OrdenTrabajo[]>(this.url, { params });
  }
  obtener(id: string) {
    return this.http.get<OrdenTrabajo>(`${this.url}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class AlertasApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/alertas`;

  listar() {
    return this.http.get<Alerta[]>(this.url);
  }
  resolver(id: string) {
    return this.http.post<{ ok: boolean }>(`${this.url}/${id}/resolver`, {});
  }
}

export interface ResultadoSync {
  id: string;
  ok: boolean;
  error?: string;
  reintentar?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SyncApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/sync`;

  snapshot() {
    return this.http.get<Snapshot>(`${this.url}/snapshot`);
  }
  enviar(operaciones: unknown[]) {
    return this.http.post<{ resultados: ResultadoSync[] }>(this.url, { operaciones });
  }
}

// ---------------------------------------------------------------- Iteración 3

@Injectable({ providedIn: 'root' })
export class ServiciosApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/servicios`;

  listar(inactivos = false) {
    return this.http.get<Servicio[]>(this.url, { params: { inactivos } });
  }
  crear(data: Partial<Servicio>) {
    return this.http.post<Servicio>(this.url, data);
  }
  actualizar(id: string, data: Partial<Servicio>) {
    return this.http.patch<Servicio>(`${this.url}/${id}`, data);
  }
}

@Injectable({ providedIn: 'root' })
export class TallerApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/taller`;

  obtener() {
    return this.http.get<Taller>(this.url);
  }
  actualizar(data: Partial<Taller>) {
    return this.http.patch<Taller>(this.url, data);
  }
}

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);

  kpis(desde: string, hasta: string) {
    return this.http.get<Dashboard>(`${API_URL}/dashboard`, { params: { desde, hasta } });
  }
}
