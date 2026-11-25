import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { DatosService } from '../../core/datos.service';
import { OrdenTrabajo, Rol } from '../../core/models';
import { OrdenDetalleComponent } from './orden-detalle.component';

function orden(estado: OrdenTrabajo['estado'] = 'EN_DIAGNOSTICO'): OrdenTrabajo {
  return {
    id: 'orden-prueba', numero: 1, vehiculoId: 'vehiculo', clienteId: 'cliente', mecanicoId: 'mecanico',
    estado, problemaReportado: 'Ruido al frenar', diagnostico: null, observacionesRecepcion: null,
    kilometrajeIngreso: 1000, sinRepuestos: false, descuento: 0,
    fechaIngreso: '2026-11-25T12:00:00Z', fechaTerminado: null, fechaEntrega: null,
    manoObra: [], repuestos: [], externos: [], pagos: [], historial: [],
  };
}

describe('Pantalla del detalle de la orden', () => {
  let fixture: ComponentFixture<OrdenDetalleComponent>;
  let datos: jasmine.SpyObj<DatosService>;
  let rol: Rol;
  let actual: OrdenTrabajo;
  const html = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string, dentro: ParentNode = html()) =>
    Array.from(dentro.querySelectorAll('button')).find(b => b.textContent?.trim() === texto)!;
  async function render() { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); }
  async function input(selector: string, valor: string) {
    const e = html().querySelector<HTMLInputElement>(selector)!;
    e.value = valor; e.dispatchEvent(new Event('input')); await render();
  }
  async function abrir(nombre: string) { boton(nombre).click(); await render(); }

  beforeEach(async () => {
    rol = 'ADMIN'; actual = orden();
    datos = jasmine.createSpyObj('DatosService', ['obtenerOrden', 'personal', 'buscarRepuestos', 'servicios',
      'agregarManoObra', 'agregarRepuesto', 'agregarRepuestoExterno', 'actualizarOrden']);
    datos.obtenerOrden.and.callFake(async () => actual);
    datos.personal.and.resolveTo([]); datos.buscarRepuestos.and.resolveTo([]);
    datos.servicios.and.resolveTo([{ id: 'servicio', nombre: 'Cambio de aceite', precio: 80, activo: true, horasEstimadas: null }]);
    datos.agregarManoObra.and.callFake(async (_o, d) => ({ ...actual,
      manoObra: [{ id: 'trabajo', servicioId: d.servicioId ?? null, descripcion: d.descripcion, monto: d.monto, mecanicoId: 'mecanico' }] }));
    await TestBed.configureTestingModule({ imports: [OrdenDetalleComponent], providers: [provideRouter([]),
      { provide: DatosService, useValue: datos },
      { provide: AuthService, useValue: {
        tieneRol: (...roles: Rol[]) => roles.includes(rol),
        usuario: signal({ id: 'mecanico', nombre: 'Operador', rol: 'ADMIN', taller: { nombre: 'Taller de pruebas' } }),
      } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(OrdenDetalleComponent);
    fixture.componentRef.setInput('id', 'orden-prueba');
    await render();
  });

  it('en Recibido muestra asignación y adelanto, sin formularios de trabajo', async () => {
    fixture.componentInstance.orden.set(orden('RECIBIDO')); await render();
    expect(html().textContent).toContain('Adelanto del cliente');
    expect(html().querySelector('select.buscador')).not.toBeNull();
    expect(boton('Del inventario')).toBeUndefined();
    expect(html().querySelector('[role="dialog"]')).toBeNull();
  });

  it('en Diagnóstico muestra Presupuesto y mantiene ocultos los formularios hasta abrirlos', () => {
    expect(html().textContent).toContain('Presupuesto');
    expect(html().querySelector('#mod')).toBeNull();
    expect(html().querySelector('#rep')).toBeNull();
    expect(html().textContent).not.toContain('Repuestos externos');
  });

  it('abre y cierra la ventana de repuestos con la X', async () => {
    await abrir('Del inventario');
    const dialogo = html().querySelector('[role="dialog"]')!;
    expect(dialogo.querySelector('#rep')).not.toBeNull();
    expect(boton('Agregar', dialogo).disabled).toBeTrue();
    (dialogo.querySelector('[aria-label="Cerrar"]') as HTMLButtonElement).click(); await render();
    expect(html().querySelector('[role="dialog"]')).toBeNull();
  });

  it('conserva la ventana al pulsar dentro y la cierra al pulsar fuera', async () => {
    await abrir('Del inventario');
    (html().querySelector('[role="dialog"]') as HTMLElement).click(); await render();
    expect(html().querySelector('[role="dialog"]')).not.toBeNull();
    (html().querySelector('.modal-velo') as HTMLElement).click(); await render();
    expect(html().querySelector('[role="dialog"]')).toBeNull();
  });

  it('busca un servicio, completa precio y agrega la mano de obra cerrando la ventana', async () => {
    await abrir('Agregar');
    await input('#mod', 'Cambio');
    const opcion = Array.from(html().querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
      .find(b => b.textContent?.includes('Cambio de aceite'))!;
    opcion.click(); await render();
    expect((html().querySelector('#mom') as HTMLInputElement).value).toBe('80');
    boton('Agregar mano de obra').click(); await render();
    expect(datos.agregarManoObra).toHaveBeenCalled();
    expect(html().querySelector('[role="dialog"]')).toBeNull();
    expect(html().textContent).toContain('Cambio de aceite');
  });

  it('muestra un error de stock dentro de la ventana y permite corregirlo', async () => {
    datos.agregarRepuesto.and.rejectWith(new Error('Stock insuficiente'));
    await abrir('Del inventario');
    fixture.componentInstance.repuestoId = 'pieza'; await render();
    boton('Agregar', html().querySelector('[role="dialog"]')!).click(); await render();
    expect(html().querySelector('[role="dialog"]')?.textContent).toContain('Stock insuficiente');
    expect(boton('Agregar', html().querySelector('[role="dialog"]')!).disabled).toBeFalse();
  });

  it('permite elegir un repuesto del cliente sin mostrar precios de venta', async () => {
    await abrir('Externo');
    const dialogo = html().querySelector('[role="dialog"]')!;
    expect(dialogo.querySelector('#exc')).not.toBeNull();
    expect(dialogo.querySelector('#expre')).toBeNull();
    boton('Lo compra el taller', dialogo).click(); await render();
    expect(html().querySelector('#expre')).not.toBeNull();
  });

  it('reserva el descuento al administrador', async () => {
    expect(html().querySelector('.descuento')).not.toBeNull();
    rol = 'MECANICO'; await render();
    expect(html().querySelector('.descuento')).toBeNull();
  });

  it('en Entregado oculta las acciones para agregar costos y avanzar', async () => {
    fixture.componentInstance.orden.set(orden('ENTREGADO')); await render();
    expect(boton('Del inventario')).toBeUndefined(); expect(boton('Agregar')).toBeUndefined();
    expect(html().querySelector('.acciones-estado')).toBeNull();
  });

  it('en Terminado prepara WhatsApp con número boliviano, vehículo y saldo sin enviarlo', async () => {
    const o = orden('TERMINADO');
    o.cliente = { id: 'cliente', nombre: 'Cliente de prueba', telefono: '70000000' } as OrdenTrabajo['cliente'];
    o.vehiculo = { placa: '1234ABC', marca: 'Toyota', modelo: 'Corolla' } as OrdenTrabajo['vehiculo'];
    o.manoObra = [{ id: 'trabajo', servicioId: null, descripcion: 'Revisión', monto: 100, mecanicoId: 'mecanico' }];
    fixture.componentInstance.orden.set(o); await render();
    const enlace = html().querySelector<HTMLAnchorElement>('.boton-whatsapp')!;
    const url = new URL(enlace.href);
    expect(url.pathname).toBe('/59170000000');
    expect(url.searchParams.get('text')).toContain('1234ABC');
    expect(url.searchParams.get('text')).toContain('Saldo pendiente: Bs 100');
    expect(enlace.target).toBe('_blank');
  });

  it('pide corregir el teléfono en vez de abrir un WhatsApp inválido', async () => {
    const o = orden('TERMINADO');
    o.cliente = { nombre: 'Cliente', telefono: 'abc' } as OrdenTrabajo['cliente'];
    fixture.componentInstance.orden.set(o); await render();
    expect(html().querySelector('.boton-whatsapp')).toBeNull();
    expect(html().textContent).toContain('Complete o corrija el teléfono');
  });
});
