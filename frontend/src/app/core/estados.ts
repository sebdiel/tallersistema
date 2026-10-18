import { EstadoOrden, OrdenTrabajo } from './models';

/**
 * Copia de la máquina de estados del backend (ordenes/maquina-estados.ts).
 * Se valida también en el dispositivo para dar el mismo mensaje sin conexión;
 * el servidor vuelve a validar al sincronizar.
 */
export const TRANSICIONES: Record<EstadoOrden, EstadoOrden[]> = {
  RECIBIDO: ['EN_DIAGNOSTICO', 'CANCELADO'],
  EN_DIAGNOSTICO: ['EN_REPARACION', 'CANCELADO'],
  EN_REPARACION: ['TERMINADO', 'CANCELADO'],
  TERMINADO: ['ENTREGADO', 'EN_REPARACION'],
  ENTREGADO: [],
  CANCELADO: [],
};

export const ESTADOS_ABIERTOS: EstadoOrden[] = [
  'RECIBIDO',
  'EN_DIAGNOSTICO',
  'EN_REPARACION',
  'TERMINADO',
];

export const ESTADOS_CON_REPUESTOS: EstadoOrden[] = ['EN_DIAGNOSTICO', 'EN_REPARACION'];

export const ESTADO_INFO: Record<EstadoOrden, { texto: string; clase: string }> = {
  RECIBIDO: { texto: 'Recibido', clase: 'est-recibido' },
  EN_DIAGNOSTICO: { texto: 'En diagnóstico', clase: 'est-diagnostico' },
  EN_REPARACION: { texto: 'En reparación', clase: 'est-reparacion' },
  TERMINADO: { texto: 'Terminado', clase: 'est-terminado' },
  ENTREGADO: { texto: 'Entregado', clase: 'est-entregado' },
  CANCELADO: { texto: 'Cancelado', clase: 'est-cancelado' },
};

/** Texto del botón para avanzar a cada estado. */
export const ACCION_ESTADO: Record<EstadoOrden, string> = {
  RECIBIDO: '',
  EN_DIAGNOSTICO: 'Iniciar diagnóstico',
  EN_REPARACION: 'Iniciar reparación',
  TERMINADO: 'Marcar terminado',
  ENTREGADO: 'Entregar al cliente',
  CANCELADO: 'Cancelar orden',
};

export function validarTransicion(
  orden: Pick<OrdenTrabajo, 'estado' | 'diagnostico' | 'mecanicoId' | 'sinRepuestos'> & {
    totalRepuestos: number;
    saldo?: number;
    pagado?: number;
    esAdmin?: boolean;
  },
  destino: EstadoOrden,
  comentario?: string | null,
): string | null {
  if (!TRANSICIONES[orden.estado].includes(destino)) {
    return `No se puede pasar de ${orden.estado} a ${destino}`;
  }
  switch (destino) {
    case 'EN_DIAGNOSTICO':
      if (!orden.mecanicoId) return 'Asigne un mecánico antes de iniciar el diagnóstico';
      break;
    case 'EN_REPARACION':
      if (!orden.diagnostico?.trim()) return 'Registre el diagnóstico antes de iniciar la reparación';
      break;
    case 'TERMINADO':
      if (orden.totalRepuestos === 0 && !orden.sinRepuestos) {
        return 'Registre los repuestos utilizados o confirme que no se usaron repuestos';
      }
      break;
    case 'CANCELADO':
      if (!comentario?.trim()) return 'Indique el motivo de la cancelación';
      if ((orden.pagado ?? 0) > 0) return 'La orden tiene pagos registrados. Anúlelos antes de cancelar';
      break;
    case 'ENTREGADO':
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
  if (orden.estado === 'TERMINADO' && destino === 'EN_REPARACION' && !comentario?.trim()) {
    return 'Indique el motivo para reabrir la orden';
  }
  return null;
}
