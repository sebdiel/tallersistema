import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from './config';
import { Cliente, FichaVehiculo, Usuario, Vehiculo } from './models';

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
