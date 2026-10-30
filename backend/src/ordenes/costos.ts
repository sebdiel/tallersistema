/**
 * HU-19 / RN-15: cálculo automático del costo de la orden de trabajo.
 *
 *   total = Σ(repuestos del inventario) + Σ(repuestos externos) + Σ(mano de obra) − descuento
 *   saldo = total − Σ(pagos no anulados)
 *
 * Los precios unitarios se congelan al registrar cada línea, por lo que un
 * cambio de precio posterior en el inventario no altera órdenes ya cargadas.
 */
export interface Totales {
  repuestos: number;
  /** RN-28: repuestos comprados afuera (los que trae el cliente valen 0). */
  externos: number;
  manoObra: number;
  subtotal: number;
  descuento: number;
  total: number;
  pagado: number;
  saldo: number;
}

interface OrdenConCostos {
  descuento?: number | null;
  repuestos?: { cantidad: number; precioUnitario: number }[];
  manoObra?: { monto: number }[];
  externos?: { cantidad: number; precioUnitario: number }[];
  pagos?: { monto: number; anulado: boolean }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularTotales(o: OrdenConCostos): Totales {
  const repuestos = r2((o.repuestos ?? []).reduce((s, l) => s + l.cantidad * l.precioUnitario, 0));
  const manoObra = r2((o.manoObra ?? []).reduce((s, l) => s + l.monto, 0));
  const externos = r2((o.externos ?? []).reduce((s, l) => s + l.cantidad * l.precioUnitario, 0));
  const subtotal = r2(repuestos + externos + manoObra);
  const descuento = r2(o.descuento ?? 0);
  const total = r2(subtotal - descuento);
  const pagado = r2((o.pagos ?? []).filter((p) => !p.anulado).reduce((s, p) => s + p.monto, 0));
  return { repuestos, externos, manoObra, subtotal, descuento, total, pagado, saldo: r2(total - pagado) };
}
