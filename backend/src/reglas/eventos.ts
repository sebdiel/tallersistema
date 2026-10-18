import { EstadoOrden } from '../ordenes/maquina-estados';

/**
 * Eventos de dominio. Los servicios los emiten después de confirmar la
 * transacción; el motor de reglas (reglas.listener.ts) reacciona a ellos.
 */
export const EVENTOS = {
  STOCK_CAMBIADO: 'inventario.stock-cambiado',
  ORDEN_ESTADO_CAMBIADO: 'orden.estado-cambiado',
} as const;

export interface StockCambiadoEvent {
  tallerId: string;
  repuestoIds: string[];
}

export interface OrdenEstadoCambiadoEvent {
  tallerId: string;
  ordenId: string;
  numero: number;
  placa: string;
  anterior: EstadoOrden;
  nuevo: EstadoOrden;
}
