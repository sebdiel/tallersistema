import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Las fechas del dashboard se interpretan en hora de Bolivia. */
const TZ = 'America/La_Paz';
const DIA = (col: string) => `(${col} AT TIME ZONE '${TZ}')::date BETWEEN $2::date AND $3::date`;
const MAX_DIAS = 366;

const num = (v: unknown) => (v == null ? 0 : Math.round(Number(v) * 100) / 100);
const numONull = (v: unknown) => (v == null ? null : Math.round(Number(v) * 10) / 10);

export interface ResumenPeriodo {
  ingresos: number;
  cobros: number;
  recibidas: number;
  entregadas: number;
  terminadas: number;
  canceladas: number;
  facturado: number;
  ticketPromedio: number;
  repuestos: number;
  manoObra: number;
  margenRepuestos: number;
  horasReparacion: number | null;
  horasEnTaller: number | null;
  tasaReapertura: number;
  cumplimiento: number;
}

/**
 * HU-22, HU-23, HU-24: indicadores clave de rendimiento (KPIs).
 *
 * Todo se calcula a partir de los registros operativos (OT, historial de
 * estados, repuestos, mano de obra y pagos), es decir, de los datos que
 * antes quedaban dispersos en cuadernos y no permitían medir nada.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly db: DataSource) {}

  async kpis(tallerId: string, desde: string, hasta: string) {
    const dias = diasEntre(desde, hasta);
    if (dias < 1) throw new BadRequestException('La fecha "desde" debe ser anterior a "hasta"');
    if (dias > MAX_DIAS) throw new BadRequestException(`El rango máximo es de ${MAX_DIAS} días`);

    // Período anterior de igual duración, para comparar (Δ en los indicadores).
    const antHasta = sumarDias(desde, -1);
    const antDesde = sumarDias(desde, -dias);
    const p = [tallerId, desde, hasta];

    const [
      resumen,
      anterior,
      ingresosPorDia,
      ingresosPorMetodo,
      tiempoPorEtapa,
      abiertasPorEstado,
      topRepuestos,
      serviciosFrecuentes,
      mecanicos,
      marcas,
      inventario,
      cuentasPorCobrar,
    ] = await Promise.all([
      this.resumen(tallerId, desde, hasta),
      this.resumen(tallerId, antDesde, antHasta),
      this.db.query(
        `SELECT to_char(d, 'YYYY-MM-DD') AS dia, COALESCE(SUM(p.monto), 0) AS monto
           FROM generate_series($2::date, $3::date, interval '1 day') d
           LEFT JOIN pagos p ON p.taller_id = $1 AND NOT p.anulado
                            AND (p.fecha AT TIME ZONE '${TZ}')::date = d::date
          GROUP BY d ORDER BY d`,
        p,
      ),
      this.db.query(
        `SELECT metodo, COUNT(*) AS cantidad, SUM(monto) AS monto
           FROM pagos WHERE taller_id = $1 AND NOT anulado AND ${DIA('fecha')}
          GROUP BY metodo ORDER BY monto DESC`,
        p,
      ),
      // Tiempo promedio en cada etapa = de la entrada a un estado hasta el siguiente.
      this.db.query(
        `WITH h AS (
           SELECT h.orden_id, h.estado_nuevo, h.fecha,
                  LEAD(h.fecha) OVER (PARTITION BY h.orden_id ORDER BY h.fecha) AS siguiente
             FROM orden_historial_estados h
             JOIN ordenes_trabajo o ON o.id = h.orden_id
            WHERE o.taller_id = $1)
         SELECT estado_nuevo AS etapa,
                AVG(EXTRACT(EPOCH FROM siguiente - fecha)) / 3600 AS horas,
                COUNT(DISTINCT orden_id) AS ordenes
           FROM h
          WHERE siguiente IS NOT NULL AND ${DIA('siguiente')}
            AND estado_nuevo IN ('RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO')
          GROUP BY estado_nuevo`,
        p,
      ),
      this.db.query(
        `SELECT estado, COUNT(*) AS total FROM ordenes_trabajo
          WHERE taller_id = $1 AND estado IN ('RECIBIDO', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO')
          GROUP BY estado`,
        [tallerId],
      ),
      this.db.query(
        `SELECT rp.id, rp.codigo, rp.nombre, rp.unidad, rp.stock,
                SUM(r.cantidad) AS cantidad, SUM(r.cantidad * r.precio_unitario) AS monto
           FROM orden_repuestos r
           JOIN repuestos rp ON rp.id = r.repuesto_id
           JOIN ordenes_trabajo o ON o.id = r.orden_id
          WHERE o.taller_id = $1 AND ${DIA('r.created_at')}
          GROUP BY rp.id ORDER BY monto DESC LIMIT 8`,
        p,
      ),
      this.db.query(
        `SELECT m.descripcion, COUNT(*) AS veces, SUM(m.monto) AS monto
           FROM orden_mano_obra m
           JOIN ordenes_trabajo o ON o.id = m.orden_id
          WHERE o.taller_id = $1 AND ${DIA('m.created_at')}
          GROUP BY m.descripcion ORDER BY veces DESC, monto DESC LIMIT 6`,
        p,
      ),
      this.db.query(
        `SELECT u.id, u.nombre,
                (SELECT COUNT(*) FROM ordenes_trabajo o
                  WHERE o.mecanico_id = u.id AND o.fecha_terminado IS NOT NULL
                    AND ${DIA('o.fecha_terminado')}) AS terminadas,
                (SELECT AVG(EXTRACT(EPOCH FROM o.fecha_terminado - o.fecha_ingreso)) / 3600
                   FROM ordenes_trabajo o
                  WHERE o.mecanico_id = u.id AND o.fecha_terminado IS NOT NULL
                    AND ${DIA('o.fecha_terminado')}) AS horas,
                (SELECT COALESCE(SUM(m.monto), 0) FROM orden_mano_obra m
                  WHERE m.mecanico_id = u.id AND ${DIA('m.created_at')}) AS mano_obra
           FROM usuarios u
          WHERE u.taller_id = $1 AND u.activo
          ORDER BY terminadas DESC, mano_obra DESC`,
        p,
      ),
      this.db.query(
        `SELECT v.marca, COUNT(*) AS ordenes
           FROM ordenes_trabajo o JOIN vehiculos v ON v.id = o.vehiculo_id
          WHERE o.taller_id = $1 AND ${DIA('o.fecha_ingreso')}
          GROUP BY v.marca ORDER BY ordenes DESC LIMIT 6`,
        p,
      ),
      this.db.query(
        `SELECT COALESCE(SUM(r.stock * r.precio_compra), 0) AS valor,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE r.stock_minimo > 0 AND r.stock <= r.stock_minimo) AS bajo_minimo,
                COUNT(*) FILTER (WHERE r.stock > 0 AND NOT EXISTS (
                  SELECT 1 FROM movimientos_inventario mv
                   WHERE mv.repuesto_id = r.id AND mv.tipo = 'SALIDA' AND ${DIA('mv.fecha')})) AS sin_movimiento
           FROM repuestos r WHERE r.taller_id = $1 AND r.activo`,
        p,
      ),
      this.db.query(
        `WITH t AS (
           SELECT o.id, o.numero, o.estado, c.nombre AS cliente, v.placa,
                  COALESCE((SELECT SUM(cantidad * precio_unitario) FROM orden_repuestos WHERE orden_id = o.id), 0)
                + COALESCE((SELECT SUM(monto) FROM orden_mano_obra WHERE orden_id = o.id), 0)
                + COALESCE((SELECT SUM(cantidad * precio_unitario) FROM orden_repuestos_externos WHERE orden_id = o.id), 0)
                - o.descuento
                - COALESCE((SELECT SUM(monto) FROM pagos WHERE orden_id = o.id AND NOT anulado), 0) AS saldo
             FROM ordenes_trabajo o
             JOIN clientes c ON c.id = o.cliente_id
             JOIN vehiculos v ON v.id = o.vehiculo_id
            WHERE o.taller_id = $1 AND o.estado IN ('TERMINADO', 'ENTREGADO'))
         SELECT * FROM t WHERE saldo > 0.009 ORDER BY saldo DESC`,
        [tallerId],
      ),
    ]);

    const [inv] = inventario;
    return {
      periodo: { desde, hasta, dias, anteriorDesde: antDesde, anteriorHasta: antHasta },
      resumen,
      anterior,
      ingresosPorDia: ingresosPorDia.map((r: any) => ({ dia: r.dia, monto: num(r.monto) })),
      ingresosPorMetodo: ingresosPorMetodo.map((r: any) => ({
        metodo: r.metodo,
        cantidad: Number(r.cantidad),
        monto: num(r.monto),
      })),
      tiempoPorEtapa: tiempoPorEtapa.map((r: any) => ({
        etapa: r.etapa,
        horas: numONull(r.horas),
        ordenes: Number(r.ordenes),
      })),
      abiertasPorEstado: Object.fromEntries(
        abiertasPorEstado.map((r: any) => [r.estado, Number(r.total)]),
      ),
      topRepuestos: topRepuestos.map((r: any) => {
        const consumoDiario = Number(r.cantidad) / dias;
        return {
          id: r.id,
          codigo: r.codigo,
          nombre: r.nombre,
          unidad: r.unidad,
          stock: num(r.stock),
          cantidad: num(r.cantidad),
          monto: num(r.monto),
          // Días que alcanza el stock actual al ritmo de consumo del período.
          coberturaDias: consumoDiario > 0 ? Math.floor(Number(r.stock) / consumoDiario) : null,
        };
      }),
      serviciosFrecuentes: serviciosFrecuentes.map((r: any) => ({
        descripcion: r.descripcion,
        veces: Number(r.veces),
        monto: num(r.monto),
      })),
      mecanicos: mecanicos.map((r: any) => ({
        id: r.id,
        nombre: r.nombre,
        terminadas: Number(r.terminadas),
        horasPromedio: numONull(r.horas),
        manoObra: num(r.mano_obra),
      })),
      marcas: marcas.map((r: any) => ({ marca: r.marca, ordenes: Number(r.ordenes) })),
      inventario: {
        valor: num(inv.valor),
        total: Number(inv.total),
        bajoMinimo: Number(inv.bajo_minimo),
        sinMovimiento: Number(inv.sin_movimiento),
      },
      cuentasPorCobrar: {
        monto: num(cuentasPorCobrar.reduce((s: number, r: any) => s + Number(r.saldo), 0)),
        ordenes: cuentasPorCobrar.length,
        detalle: cuentasPorCobrar.slice(0, 10).map((r: any) => ({
          id: r.id,
          numero: r.numero,
          estado: r.estado,
          cliente: r.cliente,
          placa: r.placa,
          saldo: num(r.saldo),
        })),
      },
    };
  }

  /** Indicadores principales de un período (se calcula también para el anterior). */
  private async resumen(tallerId: string, desde: string, hasta: string): Promise<ResumenPeriodo> {
    const [r] = await this.db.query(
      `WITH entregadas AS (
         SELECT o.id, o.descuento, o.fecha_ingreso, o.fecha_entrega
           FROM ordenes_trabajo o
          WHERE o.taller_id = $1 AND o.estado = 'ENTREGADO' AND ${DIA('o.fecha_entrega')}
       ), rep AS (
         SELECT r.orden_id,
                SUM(r.cantidad * r.precio_unitario) AS venta,
                SUM(r.cantidad * (r.precio_unitario - r.costo_unitario)) AS margen
           FROM orden_repuestos r JOIN entregadas e ON e.id = r.orden_id
          GROUP BY r.orden_id
       ), mo AS (
         SELECT m.orden_id, SUM(m.monto) AS monto
           FROM orden_mano_obra m JOIN entregadas e ON e.id = m.orden_id
          GROUP BY m.orden_id
       ), ext AS (
         SELECT x.orden_id, SUM(x.cantidad * x.precio_unitario) AS venta
           FROM orden_repuestos_externos x JOIN entregadas e ON e.id = x.orden_id
          GROUP BY x.orden_id
       )
       SELECT
         (SELECT COUNT(*) FROM entregadas) AS entregadas,
         (SELECT COALESCE(SUM(COALESCE(rep.venta, 0) + COALESCE(mo.monto, 0) + COALESCE(ext.venta, 0) - e.descuento), 0)
            FROM entregadas e
            LEFT JOIN rep ON rep.orden_id = e.id
            LEFT JOIN mo ON mo.orden_id = e.id
            LEFT JOIN ext ON ext.orden_id = e.id) AS facturado,
         (SELECT COALESCE(SUM(venta), 0) FROM rep) AS repuestos,
         (SELECT COALESCE(SUM(margen), 0) FROM rep) AS margen_repuestos,
         (SELECT COALESCE(SUM(monto), 0) FROM mo) AS mano_obra,
         (SELECT AVG(EXTRACT(EPOCH FROM fecha_entrega - fecha_ingreso)) / 3600 FROM entregadas) AS horas_en_taller,
         (SELECT COUNT(*) FROM ordenes_trabajo
           WHERE taller_id = $1 AND ${DIA('fecha_ingreso')}) AS recibidas,
         (SELECT COUNT(*) FROM ordenes_trabajo
           WHERE taller_id = $1 AND ${DIA('fecha_ingreso')} AND estado = 'ENTREGADO') AS recibidas_entregadas,
         (SELECT COUNT(*) FROM orden_historial_estados h JOIN ordenes_trabajo o ON o.id = h.orden_id
           WHERE o.taller_id = $1 AND h.estado_nuevo = 'CANCELADO' AND ${DIA('h.fecha')}) AS canceladas,
         (SELECT COUNT(*) FROM ordenes_trabajo
           WHERE taller_id = $1 AND fecha_terminado IS NOT NULL AND ${DIA('fecha_terminado')}) AS terminadas,
         (SELECT AVG(EXTRACT(EPOCH FROM fecha_terminado - fecha_ingreso)) / 3600 FROM ordenes_trabajo
           WHERE taller_id = $1 AND fecha_terminado IS NOT NULL AND ${DIA('fecha_terminado')}) AS horas_reparacion,
         (SELECT COUNT(DISTINCT h.orden_id) FROM orden_historial_estados h JOIN ordenes_trabajo o ON o.id = h.orden_id
           WHERE o.taller_id = $1 AND h.estado_anterior = 'TERMINADO' AND h.estado_nuevo = 'EN_REPARACION'
             AND ${DIA('h.fecha')}) AS reaperturas,
         (SELECT COALESCE(SUM(monto), 0) FROM pagos
           WHERE taller_id = $1 AND NOT anulado AND ${DIA('fecha')}) AS ingresos,
         (SELECT COUNT(*) FROM pagos
           WHERE taller_id = $1 AND NOT anulado AND ${DIA('fecha')}) AS cobros`,
      [tallerId, desde, hasta],
    );

    const entregadas = Number(r.entregadas);
    const recibidas = Number(r.recibidas);
    const terminadas = Number(r.terminadas);
    const reaperturas = Number(r.reaperturas);
    return {
      ingresos: num(r.ingresos),
      cobros: Number(r.cobros),
      recibidas,
      entregadas,
      terminadas,
      canceladas: Number(r.canceladas),
      facturado: num(r.facturado),
      ticketPromedio: entregadas ? num(Number(r.facturado) / entregadas) : 0,
      repuestos: num(r.repuestos),
      manoObra: num(r.mano_obra),
      margenRepuestos: num(r.margen_repuestos),
      horasReparacion: numONull(r.horas_reparacion),
      horasEnTaller: numONull(r.horas_en_taller),
      // Calidad: % de trabajos que hubo que reabrir tras darlos por terminados.
      tasaReapertura: terminadas ? num((reaperturas / terminadas) * 100) : 0,
      // Cumplimiento: % de las OT recibidas en el período que ya se entregaron.
      cumplimiento: recibidas ? num((Number(r.recibidas_entregadas) / recibidas) * 100) : 0,
    };
  }
}

function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1;
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(Date.parse(fecha) + dias * 86_400_000);
  return d.toISOString().slice(0, 10);
}
