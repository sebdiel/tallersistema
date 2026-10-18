import { Totales } from './models';

/**
 * Copia de backend/src/ordenes/costos.ts (RN-15): el dispositivo calcula el
 * mismo total que el servidor, también sin conexión.
 */
interface OrdenConCostos {
  descuento?: number | null;
  repuestos?: { cantidad: number; precioUnitario: number }[];
  manoObra?: { monto: number }[];
  pagos?: { monto: number; anulado: boolean }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularTotales(o: OrdenConCostos): Totales {
  const repuestos = r2((o.repuestos ?? []).reduce((s, l) => s + l.cantidad * l.precioUnitario, 0));
  const manoObra = r2((o.manoObra ?? []).reduce((s, l) => s + l.monto, 0));
  const subtotal = r2(repuestos + manoObra);
  const descuento = r2(o.descuento ?? 0);
  const total = r2(subtotal - descuento);
  const pagado = r2((o.pagos ?? []).filter((p) => !p.anulado).reduce((s, p) => s + p.monto, 0));
  return { repuestos, manoObra, subtotal, descuento, total, pagado, saldo: r2(total - pagado) };
}
