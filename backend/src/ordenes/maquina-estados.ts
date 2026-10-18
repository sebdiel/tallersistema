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
  [EstadoOrden.EN_REPARACION]: [EstadoOrden.TERMINADO, EstadoOrden.CANCELADO],
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
}

/**
 * Devuelve el motivo por el que la transición no está permitida,
 * o `null` si se puede realizar.
 */
export function validarTransicion(
  orden: OrdenParaTransicion,
  destino: EstadoOrden,
  comentario?: string | null,
): string | null {
  // RN-08: solo transiciones definidas en la máquina de estados.
  if (!TRANSICIONES[orden.estado].includes(destino)) {
    return `No se puede pasar de ${orden.estado} a ${destino}`;
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
      break;
  }

  // Reabrir una orden terminada exige explicar por qué.
  if (orden.estado === EstadoOrden.TERMINADO && destino === EstadoOrden.EN_REPARACION) {
    if (!comentario?.trim()) return 'Indique el motivo para reabrir la orden';
  }

  return null;
}
