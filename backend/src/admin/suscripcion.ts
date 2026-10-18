/**
 * Reglas de la suscripción del taller (modelo comercial SaaS, Iteración 4).
 *
 *   ACTIVA ──(faltan ≤ 7 días)──► POR_VENCER ──(vence)──► EN_GRACIA ──(5 días)──► VENCIDA
 *      ▲                                                                        │
 *      └──────────────────────── registrar pago ◄────────────────────────────────┘
 *
 * RN-21: durante el período de gracia el taller sigue trabajando, con aviso.
 * RN-22: VENCIDA o SUSPENDIDA bloquea el acceso del personal del taller.
 */
export type EstadoSuscripcion = 'ACTIVA' | 'POR_VENCER' | 'EN_GRACIA' | 'VENCIDA' | 'SUSPENDIDA';

export const DIAS_AVISO = 7;
export const DIAS_GRACIA = 5;

export interface InfoSuscripcion {
  estado: EstadoSuscripcion;
  vigenteHasta: string;
  /** Días hasta el vencimiento (negativo si ya venció). */
  diasRestantes: number;
  /** Puede usar el sistema. */
  habilitado: boolean;
  mensaje: string | null;
}

const MS_DIA = 86_400_000;

/** Fecha de hoy en Bolivia (UTC−4) como AAAA-MM-DD. */
export function hoyBolivia(ahora = new Date()): string {
  return new Date(ahora.getTime() - 4 * 3_600_000).toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / MS_DIA);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(fecha) + dias * MS_DIA).toISOString().slice(0, 10);
}

/** Suma meses respetando fin de mes (31/01 + 1 mes = 28 o 29/02). */
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const destino = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(d, ultimoDia));
  return destino.toISOString().slice(0, 10);
}

const fmt = (f: string) => f.split('-').reverse().join('/');

export function estadoSuscripcion(
  taller: { activo: boolean; vigenteHasta: string },
  hoy = hoyBolivia(),
): InfoSuscripcion {
  const diasRestantes = diasEntre(hoy, taller.vigenteHasta);
  const base = { vigenteHasta: taller.vigenteHasta, diasRestantes };

  if (!taller.activo) {
    return {
      ...base,
      estado: 'SUSPENDIDA',
      habilitado: false,
      mensaje: 'El acceso del taller está suspendido. Comuníquese con el proveedor del sistema.',
    };
  }
  if (diasRestantes > DIAS_AVISO) return { ...base, estado: 'ACTIVA', habilitado: true, mensaje: null };
  if (diasRestantes >= 0) {
    return {
      ...base,
      estado: 'POR_VENCER',
      habilitado: true,
      mensaje:
        diasRestantes === 0
          ? 'La suscripción vence hoy.'
          : `La suscripción vence en ${diasRestantes} día(s) (${fmt(taller.vigenteHasta)}).`,
    };
  }
  if (-diasRestantes <= DIAS_GRACIA) {
    const quedan = DIAS_GRACIA + diasRestantes;
    return {
      ...base,
      estado: 'EN_GRACIA',
      habilitado: true,
      mensaje: `La suscripción venció el ${fmt(taller.vigenteHasta)}. Le quedan ${quedan} día(s) de gracia antes del bloqueo.`,
    };
  }
  return {
    ...base,
    estado: 'VENCIDA',
    habilitado: false,
    mensaje: `La suscripción del taller venció el ${fmt(taller.vigenteHasta)}. Para seguir usando el sistema renueve el pago con el proveedor.`,
  };
}

/**
 * RN-23: un pago extiende la vigencia desde el vencimiento actual si aún no
 * venció (no se pierden días pagados), o desde hoy si ya venció.
 */
export function nuevaVigencia(vigenteHasta: string, meses: number, hoy = hoyBolivia()) {
  const desde = vigenteHasta >= hoy ? sumarDias(vigenteHasta, 1) : hoy;
  return { desde, hasta: sumarDias(sumarMeses(desde, meses), -1) };
}
