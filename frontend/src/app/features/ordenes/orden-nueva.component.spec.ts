import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ConexionService } from '../../core/conexion.service';
import { DatosService } from '../../core/datos.service';
import { OrdenTrabajo, Vehiculo } from '../../core/models';
import { OrdenNuevaComponent } from './orden-nueva.component';

describe('Pantalla de recepción', () => {
  let fixture: ComponentFixture<OrdenNuevaComponent>;
  let datos: jasmine.SpyObj<DatosService>;
  const html = () => fixture.nativeElement as HTMLElement;
  const boton = (texto: string) => Array.from(html().querySelectorAll('button'))
    .find(b => b.textContent?.trim() === texto)!;
  async function render() { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); }
  async function escribir(selector: string, valor: string) {
    const e = html().querySelector<HTMLInputElement>(selector)!;
    e.value = valor; e.dispatchEvent(new Event('input')); await render();
  }

  beforeEach(async () => {
    datos = jasmine.createSpyObj('DatosService', ['agendaEntregas', 'buscarVehiculos', 'buscarClientes', 'crearOrden']);
    datos.agendaEntregas.and.resolveTo({}); datos.buscarVehiculos.and.resolveTo([]); datos.buscarClientes.and.resolveTo([]);
    await TestBed.configureTestingModule({ imports: [OrdenNuevaComponent], providers: [provideRouter([]),
      { provide: DatosService, useValue: datos },
      { provide: ConexionService, useValue: { enLinea: signal(true) } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(OrdenNuevaComponent); await render();
  });

  it('abre vehículo nuevo y muestra la validación sin cerrar la ventana', async () => {
    boton('Vehículo nuevo').click(); await render();
    expect(html().querySelector('[role="dialog"]')).not.toBeNull();
    boton('Listo').click(); await render();
    expect(html().textContent).toContain('Complete placa, marca y modelo');
    expect(html().querySelector('[role="dialog"]')).not.toBeNull();
    expect(datos.crearOrden).not.toHaveBeenCalled();
  });

  it('valida teléfono del cliente y conserva los datos al corregirlo', async () => {
    boton('Vehículo nuevo').click(); await render();
    await escribir('#placa', '1234ABC'); await escribir('#marca', 'Toyota'); await escribir('#modelo', 'Corolla');
    boton('Cliente nuevo').click(); await render();
    await escribir('#cnombre', 'Cliente de prueba'); await escribir('#ctel', 'abc');
    boton('Listo').click(); await render();
    expect(html().textContent).toContain('Complete nombre y teléfono del cliente');
    await escribir('#ctel', '70000000');
    boton('Listo').click(); await render();
    expect(html().querySelector('[role="dialog"]')).toBeNull();
    expect(html().querySelector('.resumen-nuevo')?.textContent).toContain('1234ABC');
    expect(html().querySelector('.resumen-nuevo')?.textContent).toContain('Cliente de prueba');
  });

  it('al cancelar el alta inicial vuelve a buscar vehículos registrados', async () => {
    boton('Vehículo nuevo').click(); await render();
    boton('Cancelar').click(); await render();
    expect(fixture.componentInstance.modo()).toBe('existente');
    expect(html().querySelector('[role="dialog"]')).toBeNull();
  });

  it('impide guardar sin motivo o con costo estimado negativo', async () => {
    fixture.componentInstance.vehiculo.set({ id: 'vehiculo', kilometraje: 1000 } as Vehiculo); await render();
    await fixture.componentInstance.guardar(); await render();
    expect(datos.crearOrden).not.toHaveBeenCalled();
    await escribir('#problema', 'Cambio de aceite'); await escribir('#costo', '-10');
    await fixture.componentInstance.guardar(); await render();
    expect(datos.crearOrden).not.toHaveBeenCalled();
    expect(html().textContent).toContain('Revise');
  });

  it('pide confirmar un día ocupado antes de asignar la entrega', async () => {
    const componente = fixture.componentInstance;
    componente.agenda.set({ [componente.hoy]: [{ id: 'otra', vehiculo: { placa: '2345XYZ' } } as OrdenTrabajo] });
    await render(); (html().querySelector('.dia') as HTMLButtonElement).click(); await render();
    expect(componente.entrega()).toBeNull();
    expect(html().textContent).toContain('2345XYZ');
    boton('Sí, acepto esa fecha').click(); await render();
    expect(componente.entrega()).toBe(componente.hoy);
    expect(html().querySelector('[role="alertdialog"]')).toBeNull();
  });
});
