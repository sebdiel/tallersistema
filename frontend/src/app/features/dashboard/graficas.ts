import { ChartConfiguration } from 'chart.js';

/**
 * Estilo común de las gráficas del dashboard.
 *
 * Todas son de UNA serie (magnitud), por lo que usan un solo tono (azul
 * validado: contraste ≥ 3:1 sobre blanco) y no llevan leyenda: el título de la
 * tarjeta nombra la serie. Barras finas con extremo redondeado de 4px, grilla
 * tenue de 1px, tooltip al pasar el dedo/mouse, y tabla de datos alternativa.
 */
export const COLOR_SERIE = '#2a78d6';
const COLOR_HOVER = '#1c5cab';
const GRILLA = '#eef0f3';
const TEXTO_EJES = '#6b7280';

const bs = (v: number) =>
  'Bs ' + v.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatoBs = bs;

export function dataset(datos: number[], etiqueta: string) {
  return {
    data: datos,
    label: etiqueta,
    backgroundColor: COLOR_SERIE,
    hoverBackgroundColor: COLOR_HOVER,
    borderRadius: 4,
    borderSkipped: 'start' as const,
    maxBarThickness: 28,
    categoryPercentage: 0.85,
    barPercentage: 0.9,
  };
}

/** Opciones de barras. `horizontal` para categorías con nombres largos. */
export function opcionesBarras(
  formato: (v: number) => string,
  horizontal = false,
): ChartConfiguration<'bar'>['options'] {
  const ejeValor = {
    beginAtZero: true,
    grid: { color: GRILLA, lineWidth: 1 },
    border: { display: false },
    ticks: { color: TEXTO_EJES, maxTicksLimit: 5, callback: (v: string | number) => formato(Number(v)) },
  };
  const ejeCategoria = {
    grid: { display: false },
    border: { display: false },
    ticks: { color: TEXTO_EJES, autoSkip: true, maxRotation: 0 },
  };
  return {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937',
        padding: 10,
        displayColors: false,
        callbacks: { label: (ctx) => formato(Number(ctx.raw)) },
      },
    },
    scales: horizontal ? { x: ejeValor, y: ejeCategoria } : { x: ejeCategoria, y: ejeValor },
  };
}

export const horas = (h: number) => (h >= 48 ? `${(h / 24).toFixed(1)} d` : `${h.toFixed(1)} h`);
export const ETAPAS: Record<string, string> = {
  RECIBIDO: 'Espera de diagnóstico',
  EN_DIAGNOSTICO: 'Diagnóstico',
  EN_REPARACION: 'Reparación',
  TERMINADO: 'Espera de entrega',
};
