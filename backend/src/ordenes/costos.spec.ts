import { calcularTotales } from './costos';

describe('RN-15 cálculo automático de costos de la OT', () => {
  it('suma repuestos y mano de obra, resta descuento y pagos no anulados', () => {
    const t = calcularTotales({
      descuento: 10,
      repuestos: [
        { cantidad: 2, precioUnitario: 40 },
        { cantidad: 4.5, precioUnitario: 55 },
      ],
      manoObra: [{ monto: 80 }, { monto: 50 }],
      pagos: [
        { monto: 200, anulado: false },
        { monto: 999, anulado: true },
      ],
    });
    expect(t).toEqual({
      repuestos: 327.5,
      externos: 0,
      manoObra: 130,
      subtotal: 457.5,
      descuento: 10,
      total: 447.5,
      pagado: 200,
      saldo: 247.5,
    });
  });

  it('redondea a centavos (evita errores de punto flotante)', () => {
    const t = calcularTotales({ repuestos: [{ cantidad: 3, precioUnitario: 0.1 }] });
    expect(t.total).toBe(0.3);
  });

  it('RN-28: suma repuestos externos (los que trae el cliente valen 0)', () => {
    const t = calcularTotales({
      externos: [
        { cantidad: 1, precioUnitario: 150 },
        { cantidad: 2, precioUnitario: 0 },
      ],
      manoObra: [{ monto: 30 }],
    });
    expect(t.externos).toBe(150);
    expect(t.total).toBe(180);
  });

  it('una OT vacía cuesta 0', () => {
    expect(calcularTotales({}).total).toBe(0);
  });
});
