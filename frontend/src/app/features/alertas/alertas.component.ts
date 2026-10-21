import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertasService } from '../../core/alertas.service';
import { ConexionService } from '../../core/conexion.service';
import { IconoComponent } from '../../layout/icono.component';

const ICONO: Record<string, string> = {
  STOCK_BAJO: 'inventario',
  ORDEN_TERMINADA: 'ok',
  SUSCRIPCION: 'comprobante',
};

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [IconoComponent, RouterLink],
  template: `
    <div class="pagina">
      <div class="encabezado">
        <h1>Notificaciones</h1>
      </div>

      @if (alertas.alertas().length) {
        <ul class="lista">
          @for (a of alertas.alertas(); track a.id) {
            <li class="item alerta-item">
              <span class="ico" [class.sus]="a.tipo === 'SUSCRIPCION'"><app-icono [nombre]="icono[a.tipo] ?? 'alerta'" /></span>
              @if (a.tipo === 'SUSCRIPCION') {
                <span class="msg">{{ a.mensaje }}</span>
              } @else {
                <a class="msg" [routerLink]="a.tipo === 'STOCK_BAJO' ? ['/inventario', a.referenciaId] : ['/ordenes', a.referenciaId]">
                  {{ a.mensaje }}
                </a>
              }
              @if (a.tipo === 'ORDEN_TERMINADA') {
                <button class="btn btn-sec" style="min-height: 34px" (click)="alertas.resolver(a)">Ya avisé</button>
              }
            </li>
          }
        </ul>
      } @else if (!conexion.enLinea()) {
        <p class="item-sub">Las notificaciones se muestran cuando hay conexión.</p>
      } @else {
        <div class="card vacio"><app-icono nombre="ok" /> No hay notificaciones pendientes.</div>
      }
    </div>
  `,
  styles: `
    .alerta-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .ico {
      font-size: 1.4rem;
      color: #f5b301;
      display: inline-flex;
    }
    .ico.sus {
      color: var(--peligro);
    }
    .msg {
      flex: 1;
      color: var(--texto);
    }
    .vacio {
      color: var(--texto-suave);
    }
  `,
})
export class AlertasComponent implements OnInit {
  readonly alertas = inject(AlertasService);
  readonly conexion = inject(ConexionService);
  readonly icono = ICONO;

  ngOnInit() {
    this.alertas.cargar();
  }
}
