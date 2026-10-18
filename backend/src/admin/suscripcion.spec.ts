import { estadoSuscripcion, hoyBolivia, nuevaVigencia, sumarMeses } from './suscripcion';

const HOY = '2026-10-18';
const taller = (vigenteHasta: string, activo = true) => ({ activo, vigenteHasta });

describe('Suscripción del taller', () => {
  it('ACTIVA con más de 7 días de vigencia', () => {
    const s = estadoSuscripcion(taller('2026-11-30'), HOY);
    expect(s.estado).toBe('ACTIVA');
    expect(s.habilitado).toBe(true);
    expect(s.mensaje).toBeNull();
  });

  it('POR_VENCER en los últimos 7 días, con aviso', () => {
    const s = estadoSuscripcion(taller('2026-10-21'), HOY);
    expect(s.estado).toBe('POR_VENCER');
    expect(s.diasRestantes).toBe(3);
    expect(s.mensaje).toMatch(/vence en 3 día/);
  });

  it('RN-21: EN_GRACIA hasta 5 días después de vencer, sigue habilitado', () => {
    const s = estadoSuscripcion(taller('2026-10-15'), HOY);
    expect(s.estado).toBe('EN_GRACIA');
    expect(s.habilitado).toBe(true);
    expect(s.mensaje).toMatch(/quedan 2 día/);
  });

  it('RN-22: VENCIDA pasado el período de gracia bloquea el acceso', () => {
    const s = estadoSuscripcion(taller('2026-10-10'), HOY);
    expect(s.estado).toBe('VENCIDA');
    expect(s.habilitado).toBe(false);
  });

  it('RN-22: SUSPENDIDA bloquea aunque esté al día', () => {
    expect(estadoSuscripcion(taller('2027-01-01', false), HOY).habilitado).toBe(false);
  });

  it('RN-23: pagar antes de vencer no pierde días', () => {
    expect(nuevaVigencia('2026-10-25', 1, HOY)).toEqual({ desde: '2026-10-26', hasta: '2026-11-25' });
  });

  it('RN-23: pagar ya vencido cuenta desde hoy', () => {
    expect(nuevaVigencia('2026-09-30', 3, HOY)).toEqual({ desde: '2026-10-18', hasta: '2027-01-17' });
  });

  it('suma meses respetando fin de mes', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('el día en Bolivia es UTC−4', () => {
    expect(hoyBolivia(new Date('2026-10-19T03:30:00Z'))).toBe('2026-10-18');
  });
});
