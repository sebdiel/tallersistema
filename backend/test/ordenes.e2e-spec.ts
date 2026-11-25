import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request = require('supertest');

jest.setTimeout(90000);

describe('Flujo real de órdenes con PostgreSQL aislado', () => {
  let app: INestApplication;
  let token: string;
  let adminId: string;
  let clienteId: string;
  let vehiculoId: string;
  let ordenId: string;
  let repuestoId: string;
  let externoId: string;

  const api = () => request(app.getHttpServer());
  const auth = () => `Bearer ${token}`;
  const estado = (nuevo: string, comentario?: string) => api().post(`/api/ordenes/${ordenId}/estado`)
    .set('Authorization', auth()).send({ estado: nuevo, ...(comentario ? { comentario } : {}) });

  beforeAll(async () => {
    if (process.env.E2E_ISOLATED !== 'true' || process.env.DB_NAME !== 'motoraapp_e2e'
      || process.env.DB_HOST !== '127.0.0.1') {
      throw new Error('Use npm run test:e2e: solo se permite la base temporal de pruebas');
    }
    const { default: migrations } = await import('../src/database/data-source');
    await migrations.initialize();
    try { await migrations.runMigrations({ transaction: 'all' }); }
    finally { await migrations.destroy(); }
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { if (app) await app.close(); });

  it('aplica todas las migraciones sobre una base vacía', async () => {
    const pendientes = await app.get(DataSource).showMigrations();
    expect(pendientes).toBe(false);
  });

  it('protege la API y permite iniciar sesión al administrador', async () => {
    await api().get('/api/ordenes').expect(401);
    const r = await api().post('/api/auth/login').send({
      email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD,
    }).expect(200);
    token = r.body.accessToken;
    adminId = r.body.usuario.id;
    expect(token).toBeTruthy();
  });

  it('registra cliente, vehículo, inventario y recepción', async () => {
    let r = await api().post('/api/clientes').set('Authorization', auth())
      .send({ nombre: 'Cliente de pruebas', telefono: '70000000' }).expect(201);
    clienteId = r.body.id;
    r = await api().post('/api/vehiculos').set('Authorization', auth())
      .send({ clienteId, placa: '1234ABC', marca: 'Toyota', modelo: 'Corolla', kilometraje: 1000 }).expect(201);
    vehiculoId = r.body.id;
    r = await api().post('/api/repuestos').set('Authorization', auth())
      .send({ codigo: 'TEST-01', nombre: 'Pastillas de prueba', stock: 5, precioCompra: 60, precioVenta: 100 }).expect(201);
    repuestoId = r.body.id;
    r = await api().post('/api/ordenes').set('Authorization', auth())
      .send({ vehiculoId, kilometrajeIngreso: 1000, problemaReportado: 'Ruido al frenar', costoEstimado: 300 }).expect(201);
    ordenId = r.body.id;
    expect(r.body.estado).toBe('RECIBIDO');
  });

  it('rechaza otra orden abierta del mismo vehículo y acepta un adelanto', async () => {
    await api().post('/api/ordenes').set('Authorization', auth())
      .send({ vehiculoId, kilometrajeIngreso: 1000, problemaReportado: 'Orden duplicada' }).expect(409);
    const r = await api().post(`/api/ordenes/${ordenId}/pagos`).set('Authorization', auth())
      .send({ monto: 50, metodo: 'EFECTIVO' }).expect(201);
    expect(r.body.totales.pagado).toBe(50);
  });

  it('exige asignación y diagnóstico antes de reparar', async () => {
    await estado('EN_DIAGNOSTICO').expect(400);
    await api().patch(`/api/ordenes/${ordenId}/mecanico`).set('Authorization', auth())
      .send({ mecanicoId: adminId }).expect(200);
    await estado('EN_DIAGNOSTICO').expect(201);
    await estado('EN_REPARACION').expect(400);
    await api().patch(`/api/ordenes/${ordenId}`).set('Authorization', auth())
      .send({ diagnostico: 'Pastillas gastadas; sustituirlas' }).expect(200);
  });

  it('arma presupuesto y descuenta stock sin mezclar mano de obra', async () => {
    await api().post(`/api/ordenes/${ordenId}/repuestos`).set('Authorization', auth())
      .send({ repuestoId, cantidad: 1 }).expect(201);
    let r = await api().post(`/api/ordenes/${ordenId}/externos`).set('Authorization', auth())
      .send({ descripcion: 'Espejo comprado afuera', origen: 'TALLER', cantidad: 1, costoUnitario: 80, precioUnitario: 100 }).expect(201);
    externoId = r.body.externos[0].id;
    r = await api().post(`/api/ordenes/${ordenId}/mano-obra`).set('Authorization', auth())
      .send({ descripcion: 'Instalación y revisión', monto: 70 }).expect(201);
    expect(r.body.totales.total).toBe(270);
    const stock = await api().get('/api/repuestos').set('Authorization', auth()).expect(200);
    expect(stock.body.find((p: { id: string }) => p.id === repuestoId).stock).toBe(4);
  });

  it('guarda presupuesto y exige motivo al corregir precio', async () => {
    let r = await estado('EN_REPARACION').expect(201);
    expect(r.body.presupuestoAprobado).toBe(270);
    await api().patch(`/api/ordenes/${ordenId}/externos/${externoId}`).set('Authorization', auth())
      .send({ precioUnitario: 120 }).expect(400);
    r = await api().patch(`/api/ordenes/${ordenId}/externos/${externoId}`).set('Authorization', auth())
      .send({ precioUnitario: 120, motivo: 'La tienda corrigió el precio' }).expect(200);
    expect(r.body.totales.total).toBe(290);
    expect(r.body.presupuestoAprobado).toBe(270);
  });

  it('termina, cobra el saldo y entrega la orden cerrada', async () => {
    await estado('TERMINADO').expect(201);
    await api().post(`/api/ordenes/${ordenId}/pagos`).set('Authorization', auth())
      .send({ monto: 241, metodo: 'EFECTIVO' }).expect(400);
    const r = await api().post(`/api/ordenes/${ordenId}/pagos`).set('Authorization', auth())
      .send({ monto: 240, metodo: 'EFECTIVO' }).expect(201);
    expect(r.body.totales.saldo).toBe(0);
    const entregada = await estado('ENTREGADO').expect(201);
    expect(entregada.body.fechaEntrega).toBeTruthy();
    await estado('EN_REPARACION').expect(400);
    await api().post(`/api/ordenes/${ordenId}/mano-obra`).set('Authorization', auth())
      .send({ descripcion: 'Cargo posterior', monto: 10 }).expect(400);
  });
});
