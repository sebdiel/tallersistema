/**
 * RN-01: la placa se guarda normalizada (mayúsculas, sin espacios ni guiones)
 * para que "2345 abc", "2345-ABC" y "2345ABC" se reconozcan como la misma placa.
 */
export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[\s-]/g, '');
}
