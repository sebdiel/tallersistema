import { BadRequestException } from '@nestjs/common';
import { UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { HistorialEstado } from './historial-estado.entity';
import { EstadoOrden } from './maquina-estados';
import { OrdenManoObra } from './orden-mano-obra.entity';
import { OrdenRepuestoExterno, OrigenRepuestoExterno } from './orden-repuesto-externo.entity';
import { OrdenRepuesto } from './orden-repuesto.entity';
import { OrdenTrabajo } from './orden.entity';
import { OrdenesService } from './ordenes.service';
import { Pago } from './pago.entity';

/**
 * Pruebas de las reglas de costos del servicio con una base de datos simulada
 * en memoria (sin PostgreSQL): RN-11, RN-17, RN-28, RN-29 y RN-30.
 */
type Fila = Record<string, any>;

function baseEnMemoria() {
  const tablas = new Map<unknown, Fila[]>();
  const tabla = (e: unknown) => {
    if (!tablas.has(e)) tablas.set(e, []);
    return tablas.get(e)!;
  };
  const coincide = (f: Fila, where: Fila = {}) => Object.entries(where).every(([k, v]) => f[k] === v);

  const m = {
    findOne: async (e: unknown, o: { where: Fila }) => tabla(e).find((f) => coincide(f, o.where)) ?? null,
    findOneByOrFail: async (e: unknown, where: Fila) => tabla(e).find((f) => coincide(f, where))!,
    find: async (e: unknown, o: { where: Fila }) => tabla(e).filter((f) => coincide(f, o.where)),
    exists: async (e: unknown, o: { where: Fila }) => tabla(e).some((f) => coincide(f, o.where)),
    count: async (e: unknown, o: { where: Fila }) => tabla(e).filter((f) => coincide(f, o.where)).length,
    insert: async (e: unknown, fila: Fila) => void tabla(e).push({ ...fila }),
    update: async (e: unknown, id: string, cambios: Fila) =>
      void Object.assign(tabla(e).find((f) => f.id === id)!, cambios),
    delete: async (e: unknown, crit: string | Fila) =>
      void tablas.set(
        e,
        tabla(e).filter((f) => (typeof crit === 'string' ? f.id !== crit : !coincide(f, crit))),
      ),
  };
  return { m, tabla };
}

const admin: UsuarioActual = { id: 'u-1', rol: Rol.ADMIN, tallerId: 't-1' } as UsuarioActual;

function preparar(estado: EstadoOrden, extra: Partial<OrdenTrabajo> = {}) {
  const { m, tabla } = baseEnMemoria();
  tabla(OrdenTrabajo).push({
    id: 'o-1',
    tallerId: 't-1',
    numero: 1,
    vehiculoId: 'v-1',
    mecanicoId: 'u-1',
    estado,
    diagnostico: 'Pastillas gastadas',
    sinRepuestos: false,
    descuento: 0,
    fechaIngreso: new Date('2026-10-01T12:00:00Z'),
    presupuestoAprobado: null,
    ...extra,
  });
  tabla(Vehiculo).push({ id: 'v-1', placa: '1234ABC' });
  const dataSource = { transaction: (fn: (mm: typeof m) => Promise<unknown>) => fn(m) };
  const repo = { findOne: async () => tabla(OrdenTrabajo)[0] };
  const service = new OrdenesService(
    repo as never,
    dataSource as never,
    { notificarStock: jest.fn(), moverStock: jest.fn() } as never,
    { emit: jest.fn() } as never,
  );
  return { service, tabla };
}

const pago = (monto: number) => ({ monto, metodo: 'EFECTIVO' as never });

describe('OrdenesService — reglas de costos', () => {
  it('RN-30: en Recibido acepta un adelanto aunque todavía no haya precio', async () => {
    const { service, tabla } = preparar(EstadoOrden.RECIBIDO);
    await service.registrarPago(admin, 'o-1', pago(100));
    expect(tabla(Pago)).toHaveLength(1);
  });

  it('RN-17: en Reparación no acepta un pago mayor al saldo', async () => {
    const { service, tabla } = preparar(EstadoOrden.EN_REPARACION);
    tabla(OrdenManoObra).push({ id: 'mo-1', ordenId: 'o-1', monto: 50 });
    await expect(service.registrarPago(admin, 'o-1', pago(80))).rejects.toThrow(BadRequestException);
    await service.registrarPago(admin, 'o-1', pago(50));
    expect(tabla(Pago)).toHaveLength(1);
  });

  it('RN-28: el repuesto que trae el cliente queda en Bs 0 aunque se envíe un precio', async () => {
    const { service, tabla } = preparar(EstadoOrden.EN_DIAGNOSTICO);
    await service.agregarRepuestoExterno(admin, 'o-1', {
      descripcion: 'Espejo lateral',
      cantidad: 1,
      origen: OrigenRepuestoExterno.CLIENTE,
      precioUnitario: 300,
      costoUnitario: 250,
    });
    expect(tabla(OrdenRepuestoExterno)[0]).toMatchObject({ precioUnitario: 0, costoUnitario: null });
  });

  it('RN-28: el repuesto comprado por el taller exige precio al cliente', async () => {
    const { service } = preparar(EstadoOrden.EN_DIAGNOSTICO);
    await expect(
      service.agregarRepuestoExterno(admin, 'o-1', {
        descripcion: 'Bomba de agua',
        cantidad: 1,
        origen: OrigenRepuestoExterno.TALLER,
      }),
    ).rejects.toThrow('Indique cuánto se cobra por el repuesto');
  });

  it('RN-29 / RN-32: exige y guarda la aprobación del cliente al pasar a reparación', async () => {
    const { service, tabla } = preparar(EstadoOrden.EN_DIAGNOSTICO);
    tabla(OrdenRepuestoExterno).push({ id: 'x-1', ordenId: 'o-1', cantidad: 1, precioUnitario: 100 });
    tabla(OrdenManoObra).push({ id: 'mo-1', ordenId: 'o-1', monto: 30 });
    await expect(
      service.cambiarEstado(admin, 'o-1', { estado: EstadoOrden.EN_REPARACION }),
    ).rejects.toThrow('Indique cómo aprobó el cliente el presupuesto');
    await service.cambiarEstado(admin, 'o-1', {
      estado: EstadoOrden.EN_REPARACION,
      medioAprobacion: 'WHATSAPP',
    });
    expect(tabla(OrdenTrabajo)[0]).toMatchObject({ presupuestoAprobado: 130, medioAprobacion: 'WHATSAPP' });
    expect(tabla(HistorialEstado)[0].comentario).toBe('Cliente aprobó el presupuesto de Bs 130.00 por WhatsApp');
  });

  it('RN-29: editar un precio cambia el total y guarda el motivo', async () => {
    const { service, tabla } = preparar(EstadoOrden.EN_REPARACION, { presupuestoAprobado: 100 });
    tabla(OrdenRepuestoExterno).push({
      id: 'x-1',
      ordenId: 'o-1',
      cantidad: 1,
      origen: OrigenRepuestoExterno.TALLER,
      precioUnitario: 100,
      costoUnitario: null,
      motivoCambio: null,
    });
    await service.editarRepuestoExterno(admin, 'o-1', 'x-1', {
      precioUnitario: 120,
      motivo: 'El espejo costaba Bs 120',
    });
    expect(tabla(OrdenRepuestoExterno)[0]).toMatchObject({
      precioUnitario: 120,
      motivoCambio: 'El espejo costaba Bs 120',
    });
  });

  it('RN-17: en Reparación no se baja un precio por debajo de lo ya pagado', async () => {
    const { service, tabla } = preparar(EstadoOrden.EN_REPARACION);
    tabla(OrdenManoObra).push({ id: 'mo-1', ordenId: 'o-1', monto: 100, motivoCambio: null });
    tabla(Pago).push({ id: 'p-1', ordenId: 'o-1', monto: 100, anulado: false });
    await expect(
      service.editarManoObra(admin, 'o-1', 'mo-1', { monto: 60, motivo: 'error' }),
    ).rejects.toThrow(/por debajo de lo ya pagado/);
  });

  it('RN-11: una orden con solo repuestos externos se puede terminar', async () => {
    const { service, tabla } = preparar(EstadoOrden.EN_REPARACION);
    tabla(OrdenRepuestoExterno).push({ id: 'x-1', ordenId: 'o-1', cantidad: 1, precioUnitario: 0 });
    expect(tabla(OrdenRepuesto)).toHaveLength(0);
    await service.cambiarEstado(admin, 'o-1', { estado: EstadoOrden.TERMINADO });
    expect(tabla(OrdenTrabajo)[0].estado).toBe(EstadoOrden.TERMINADO);
  });
});
