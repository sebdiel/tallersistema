/**
 * Máquina de estados de la orden de trabajo (sección 3.14.5).
 *
 *   RECIBIDO ─► EN_DIAGNOSTICO ─► EN_REPARACION ─► TERMINADO ─► ENTREGADO
 *      │              │                 │    ▲           │
 *      └──────────────┴─────► CANCELADO ◄┘    └───────────┘ (reabrir)
 */
export enum EstadoOrden {
  RECIBIDO = 'RECIBIDO',
  EN_DIAGNOSTICO = 'EN_DIAGNOSTICO',
  EN_REPARACION = 'EN_REPARACION',
  TERMINADO = 'TERMINADO',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

export const TRANSICIONES: Record<EstadoOrden, EstadoOrden[]> = {
  [EstadoOrden.RECIBIDO]: [EstadoOrden.EN_DIAGNOSTICO, EstadoOrden.CANCELADO],
  [EstadoOrden.EN_DIAGNOSTICO]: [EstadoOrden.EN_REPARACION, EstadoOrden.CANCELADO],
  // RN-31: si al desarmar aparece otra falla, se vuelve a diagnóstico para rehacer el presupuesto.
  [EstadoOrden.EN_REPARACION]: [EstadoOrden.TERMINADO, EstadoOrden.EN_DIAGNOSTICO, EstadoOrden.CANCELADO],
  [EstadoOrden.TERMINADO]: [EstadoOrden.ENTREGADO, EstadoOrden.EN_REPARACION],
  [EstadoOrden.ENTREGADO]: [],
  [EstadoOrden.CANCELADO]: [],
};

/** Estados en los que la orden sigue "abierta" (el vehículo está en el taller). */
export const ESTADOS_ABIERTOS = [
  EstadoOrden.RECIBIDO,
  EstadoOrden.EN_DIAGNOSTICO,
  EstadoOrden.EN_REPARACION,
  EstadoOrden.TERMINADO,
];

/** Estados en los que se pueden cargar o devolver repuestos. */
export const ESTADOS_CON_REPUESTOS = [
  EstadoOrden.EN_DIAGNOSTICO,
  EstadoOrden.EN_REPARACION,
];

/** Datos mínimos de la orden que necesitan las reglas de transición. */
export interface OrdenParaTransicion {
  estado: EstadoOrden;
  diagnostico: string | null;
  mecanicoId: string | null;
  sinRepuestos: boolean;
  totalRepuestos: number;
  /** Iteración 3: saldo y pagos de la OT, y si quien opera es administrador. */
  saldo?: number;
  pagado?: number;
  esAdmin?: boolean;
}

/**
 * Devuelve el motivo por el que la transición no está permitida,
 * o `null` si se puede realizar.
 */
/** RN-30: antes de aprobar el presupuesto se aceptan adelantos sin tope (todavía no hay precio). */
export const ESTADOS_ADELANTO: EstadoOrden[] = [EstadoOrden.RECIBIDO, EstadoOrden.EN_DIAGNOSTICO];

export function validarTransicion(
  orden: OrdenParaTransicion,
  destino: EstadoOrden,
  comentario?: string | null,
): string | null {
  // RN-08: solo transiciones definidas en la máquina de estados.
  if (!TRANSICIONES[orden.estado].includes(destino)) {
    return `No se puede pasar de ${orden.estado} a ${destino}`;
  }

  // RN-30: un adelanto puede superar el total mientras se arma el presupuesto, pero no se cierra así.
  if ((destino === EstadoOrden.TERMINADO || destino === EstadoOrden.ENTREGADO) && (orden.saldo ?? 0) < -0.001) {
    return `El cliente pagó Bs ${(-(orden.saldo ?? 0)).toFixed(2)} de más. Anule el adelanto y registre el monto correcto`;
  }

  switch (destino) {
    case EstadoOrden.EN_DIAGNOSTICO:
      if (!orden.mecanicoId) return 'Asigne un mecánico antes de iniciar el diagnóstico';
      break;
    case EstadoOrden.EN_REPARACION:
      // RN-09: no se repara sin diagnóstico documentado.
      if (!orden.diagnostico?.trim()) {
        return 'Registre el diagnóstico antes de iniciar la reparación';
      }
      break;
    case EstadoOrden.TERMINADO:
      // RN-11: evita el "olvido de registro de insumos" (riesgo operacional).
      if (orden.totalRepuestos === 0 && !orden.sinRepuestos) {
        return 'Registre los repuestos utilizados o confirme que no se usaron repuestos';
      }
      break;
    case EstadoOrden.CANCELADO:
      if (!comentario?.trim()) return 'Indique el motivo de la cancelación';
      // RN-19: primero se anulan los pagos (quedan registrados como anulados).
      if ((orden.pagado ?? 0) > 0) {
        return 'La orden tiene pagos registrados. Anúlelos antes de cancelar';
      }
      break;
    case EstadoOrden.ENTREGADO:
      // RN-18: no se entrega con deuda, salvo crédito autorizado por el administrador.
      if ((orden.saldo ?? 0) > 0) {
        const saldo = (orden.saldo ?? 0).toFixed(2);
        if (!orden.esAdmin) {
          return `El cliente tiene un saldo pendiente de Bs ${saldo}. Registre el pago antes de entregar`;
        }
        if (!comentario?.trim()) {
          return `Saldo pendiente de Bs ${saldo}: para entregar a crédito indique un comentario`;
        }
      }
      break;
  }

  // Reabrir una orden terminada exige explicar por qué.
  if (orden.estado === EstadoOrden.TERMINADO && destino === EstadoOrden.EN_REPARACION) {
    if (!comentario?.trim()) return 'Indique el motivo para reabrir la orden';
  }
  // RN-31: volver a diagnóstico exige indicar qué se encontró.
  if (orden.estado === EstadoOrden.EN_REPARACION && destino === EstadoOrden.EN_DIAGNOSTICO) {
    if (!comentario?.trim()) return 'Indique qué falla nueva se encontró';
  }

  return null;
}
