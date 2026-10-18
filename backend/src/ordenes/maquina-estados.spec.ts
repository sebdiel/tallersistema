import {
  EstadoOrden as E,
  OrdenParaTransicion,
  validarTransicion,
} from './maquina-estados';

const orden = (o: Partial<OrdenParaTransicion> = {}): OrdenParaTransicion => ({
  estado: E.RECIBIDO,
  diagnostico: null,
  mecanicoId: 'mec-1',
  sinRepuestos: false,
  totalRepuestos: 0,
  ...o,
});

describe('Máquina de estados de la orden de trabajo', () => {
  it('RN-08: rechaza saltos no definidos (RECIBIDO → TERMINADO)', () => {
    expect(validarTransicion(orden(), E.TERMINADO)).toMatch(/No se puede pasar/);
  });

  it('RN-08: no permite modificar una orden ENTREGADA', () => {
    expect(validarTransicion(orden({ estado: E.ENTREGADO }), E.EN_REPARACION)).not.toBeNull();
  });

  it('exige mecánico asignado para iniciar el diagnóstico', () => {
    expect(validarTransicion(orden({ mecanicoId: null }), E.EN_DIAGNOSTICO)).toMatch(/mecánico/);
    expect(validarTransicion(orden(), E.EN_DIAGNOSTICO)).toBeNull();
  });

  it('RN-09: exige diagnóstico para pasar a reparación', () => {
    const o = orden({ estado: E.EN_DIAGNOSTICO });
    expect(validarTransicion(o, E.EN_REPARACION)).toMatch(/diagnóstico/);
    expect(validarTransicion({ ...o, diagnostico: 'Pastillas gastadas' }, E.EN_REPARACION)).toBeNull();
  });

  it('RN-11: no se termina sin repuestos registrados ni confirmación', () => {
    const o = orden({ estado: E.EN_REPARACION, diagnostico: 'x' });
    expect(validarTransicion(o, E.TERMINADO)).toMatch(/repuestos/);
    expect(validarTransicion({ ...o, totalRepuestos: 2 }, E.TERMINADO)).toBeNull();
    expect(validarTransicion({ ...o, sinRepuestos: true }, E.TERMINADO)).toBeNull();
  });

  it('RN-18: no se entrega con saldo, salvo crédito del admin con comentario', () => {
    const t = orden({ estado: E.TERMINADO, diagnostico: 'x', saldo: 150 });
    expect(validarTransicion(t, E.ENTREGADO)).toMatch(/saldo pendiente de Bs 150.00/);
    expect(validarTransicion({ ...t, esAdmin: true }, E.ENTREGADO)).toMatch(/crédito/);
    expect(validarTransicion({ ...t, esAdmin: true }, E.ENTREGADO, 'Paga el viernes')).toBeNull();
    expect(validarTransicion({ ...t, saldo: 0 }, E.ENTREGADO)).toBeNull();
  });

  it('RN-19: no se cancela una OT con pagos vigentes', () => {
    expect(validarTransicion(orden({ pagado: 50 }), E.CANCELADO, 'x')).toMatch(/pagos/);
  });

  it('exige motivo para cancelar y para reabrir', () => {
    expect(validarTransicion(orden(), E.CANCELADO)).toMatch(/motivo/);
    expect(validarTransicion(orden(), E.CANCELADO, 'Cliente desistió')).toBeNull();

    const terminada = orden({ estado: E.TERMINADO, diagnostico: 'x' });
    expect(validarTransicion(terminada, E.EN_REPARACION)).toMatch(/reabrir/);
    expect(validarTransicion(terminada, E.EN_REPARACION, 'Sigue el ruido')).toBeNull();
  });
});
