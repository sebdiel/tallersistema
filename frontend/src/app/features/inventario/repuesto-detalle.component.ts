import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RepuestosApi } from '../../core/api.service';
import { mensajeError } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { MovimientoInventario, Repuesto } from '../../core/models';

const TIPO_TEXTO: Record<MovimientoInventario['tipo'], string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida a OT',
  DEVOLUCION: 'Devolución',
  AJUSTE: 'Ajuste',
};

/** Detalle del repuesto: kardex, reposición y ajuste por conteo físico. */
@Component({
  selector: 'app-repuesto-detalle',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, DecimalPipe],
  template: `
    <div class="pagina">
      @if (error()) {
        <div class="alerta alerta-error">{{ error() }}</div>
      }

      @if (repuesto(); as r) {
        <div class="encabezado">
          <div>
            <a routerLink="/inventario">← Inventario</a>
            <h1>{{ r.nombre }}</h1>
            <div class="item-sub">{{ r.codigo }} @if (r.marca) { · {{ r.marca }} }</div>
          </div>
          @if (auth.tieneRol('ADMIN')) {
            <a class="btn btn-sec" [routerLink]="['/inventario', r.id, 'editar']">Editar</a>
          }
        </div>

        <section class="card">
          <dl class="datos">
            <dt>Stock actual</dt>
            <dd [class.stock-bajo]="r.stock <= r.stockMinimo">{{ r.stock | number }} {{ r.unidad.toLowerCase() }}</dd>
            <dt>Stock mínimo</dt>
            <dd>{{ r.stockMinimo | number }}</dd>
            <dt>Precio compra</dt>
            <dd>Bs {{ r.precioCompra | number: '1.2-2' }}</dd>
            <dt>Precio venta</dt>
            <dd>Bs {{ r.precioVenta | number: '1.2-2' }}</dd>
            <dt>Ubicación</dt>
            <dd>{{ r.ubicacion || '—' }}</dd>
          </dl>
        </section>

        @if (auth.tieneRol('ADMIN')) {
          <div class="grid-2">
            <section class="card">
              <h2>Registrar entrada (compra)</h2>
              <div class="campo">
                <label for="cant">Cantidad</label>
                <input id="cant" type="number" min="0.01" inputmode="decimal" [(ngModel)]="entrada.cantidad" />
              </div>
              <div class="campo" style="margin-top: 8px">
                <label for="pc">Nuevo precio de compra (opcional)</label>
                <input id="pc" type="number" min="0" step="0.01" inputmode="decimal" [(ngModel)]="entrada.precioCompra" />
              </div>
              <div class="campo" style="margin-top: 8px">
                <label for="me">Nota</label>
                <input id="me" [(ngModel)]="entrada.motivo" placeholder="Proveedor / factura" />
              </div>
              <div class="acciones">
                <button class="btn" [disabled]="procesando() || !(entrada.cantidad > 0)" (click)="registrarEntrada()">Registrar entrada</button>
              </div>
            </section>

            <section class="card">
              <h2>Ajuste por conteo físico</h2>
              <div class="campo">
                <label for="real">Stock contado</label>
                <input id="real" type="number" min="0" inputmode="decimal" [(ngModel)]="ajuste.stockReal" />
              </div>
              <div class="campo" style="margin-top: 8px">
                <label class="req" for="ma">Motivo</label>
                <input id="ma" [(ngModel)]="ajuste.motivo" placeholder="Inventario mensual, pérdida…" />
              </div>
              <div class="acciones">
                <button class="btn btn-sec" [disabled]="procesando() || ajuste.stockReal == null || ajuste.motivo.trim().length < 3" (click)="ajustar()">
                  Ajustar stock
                </button>
              </div>
            </section>
          </div>
        }

        <section class="card">
          <h2>Movimientos (kardex)</h2>
          <table class="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th class="num">Cant.</th>
                <th class="num">Saldo</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              @for (m of movimientos(); track m.id) {
                <tr>
                  <td>{{ m.fecha | date: 'dd/MM HH:mm' }}</td>
                  <td>{{ tipoTexto[m.tipo] }}</td>
                  <td class="num">{{ m.cantidad > 0 ? '+' : '' }}{{ m.cantidad | number }}</td>
                  <td class="num">{{ m.stockResultante | number }}</td>
                  <td>
                    @if (m.ordenId) {
                      <a [routerLink]="['/ordenes', m.ordenId]">{{ m.motivo }}</a>
                    } @else {
                      {{ m.motivo }}
                    }
                    <div class="item-sub">{{ m.usuario?.nombre }}</div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="vacio">Sin movimientos.</td></tr>
              }
            </tbody>
          </table>
        </section>
      } @else if (!error()) {
        <p class="vacio">Cargando…</p>
      }
    </div>
  `,
})
export class RepuestoDetalleComponent implements OnInit {
  private readonly api = inject(RepuestosApi);
  readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  readonly tipoTexto = TIPO_TEXTO;
  readonly repuesto = signal<Repuesto | null>(null);
  readonly movimientos = signal<MovimientoInventario[]>([]);
  readonly error = signal<string | null>(null);
  readonly procesando = signal(false);

  entrada = { cantidad: 0, precioCompra: null as number | null, motivo: '' };
  ajuste = { stockReal: null as number | null, motivo: '' };

  ngOnInit() {
    this.cargar();
  }

  async cargar() {
    try {
      const d = await firstValueFrom(this.api.detalle(this.id()));
      this.repuesto.set(d.repuesto);
      this.movimientos.set(d.movimientos);
    } catch (err) {
      this.error.set(mensajeError(err));
    }
  }

  registrarEntrada() {
    const { cantidad, precioCompra, motivo } = this.entrada;
    this.ejecutar(
      this.api.entrada(this.id(), {
        cantidad: Number(cantidad),
        ...(precioCompra != null ? { precioCompra: Number(precioCompra) } : {}),
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      }),
      () => (this.entrada = { cantidad: 0, precioCompra: null, motivo: '' }),
    );
  }

  ajustar() {
    this.ejecutar(
      this.api.ajuste(this.id(), { stockReal: Number(this.ajuste.stockReal), motivo: this.ajuste.motivo.trim() }),
      () => (this.ajuste = { stockReal: null, motivo: '' }),
    );
  }

  private async ejecutar(peticion: ReturnType<RepuestosApi['entrada']>, limpiar: () => void) {
    this.procesando.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(peticion);
      limpiar();
      await this.cargar();
    } catch (err) {
      this.error.set(mensajeError(err));
    } finally {
      this.procesando.set(false);
    }
  }
}
