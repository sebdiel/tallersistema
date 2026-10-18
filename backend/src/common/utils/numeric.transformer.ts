import { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL devuelve las columnas `numeric` como texto para no perder
 * precisión. Para cantidades y precios del taller basta con `number`.
 */
export const numeric: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value == null ? value : Number(value)),
};
