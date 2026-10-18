import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EstadoOrden } from '../ordenes/maquina-estados';
import { formatoNumero } from '../ordenes/ordenes.service';
import { Repuesto } from '../repuestos/repuesto.entity';
import { Alerta, TipoAlerta } from './alerta.entity';
import {
  EVENTOS,
  OrdenEstadoCambiadoEvent,
  StockCambiadoEvent,
} from './eventos';

/**
 * Motor de reglas de negocio automatizadas.
 *
 * Reacciona a los eventos de dominio sin que los módulos de inventario u
 * órdenes tengan que conocer estas reglas. Agregar una regla nueva consiste
 * en escuchar el evento correspondiente aquí.
 */
@Injectable()
export class ReglasListener {
  private readonly logger = new Logger(ReglasListener.name);

  constructor(
    @InjectRepository(Alerta) private readonly alertas: Repository<Alerta>,
    @InjectRepository(Repuesto) private readonly repuestos: Repository<Repuesto>,
  ) {}

  /** RN-12: alerta de stock mínimo; se resuelve sola al reponer. */
  @OnEvent(EVENTOS.STOCK_CAMBIADO, { async: true })
  async evaluarStock(e: StockCambiadoEvent) {
    try {
      const repuestos = await this.repuestos.findBy({
        id: In(e.repuestoIds),
        tallerId: e.tallerId,
      });
      for (const r of repuestos) {
        const bajo = r.activo && r.stockMinimo > 0 && r.stock <= r.stockMinimo;
        if (bajo) {
          const mensaje =
            r.stock <= 0
              ? `Sin stock: "${r.nombre}" (${r.codigo})`
              : `Stock bajo: "${r.nombre}" (${r.codigo}) — quedan ${r.stock}, mínimo ${r.stockMinimo}`;
          await this.abrir(e.tallerId, TipoAlerta.STOCK_BAJO, r.id, mensaje);
        } else {
          await this.resolver(TipoAlerta.STOCK_BAJO, r.id);
        }
      }
    } catch (err) {
      this.logger.error('Error evaluando regla de stock', err as Error);
    }
  }

  /** RN-13: avisar cuando un vehículo queda listo para entregar. */
  @OnEvent(EVENTOS.ORDEN_ESTADO_CAMBIADO, { async: true })
  async evaluarOrden(e: OrdenEstadoCambiadoEvent) {
    try {
      if (e.nuevo === EstadoOrden.TERMINADO) {
        await this.abrir(
          e.tallerId,
          TipoAlerta.ORDEN_TERMINADA,
          e.ordenId,
          `${formatoNumero(e.numero)} (${e.placa}) terminada: avisar al cliente para el recojo`,
        );
      } else {
        await this.resolver(TipoAlerta.ORDEN_TERMINADA, e.ordenId);
      }
    } catch (err) {
      this.logger.error('Error evaluando regla de orden', err as Error);
    }
  }

  /** Crea la alerta o actualiza su mensaje si ya había una abierta. */
  private async abrir(tallerId: string, tipo: TipoAlerta, referenciaId: string, mensaje: string) {
    await this.alertas
      .createQueryBuilder()
      .insert()
      .values({ tallerId, tipo, referenciaId, mensaje })
      .orUpdate(['mensaje'], ['tipo', 'referencia_id'], {
        indexPredicate: 'resuelta = false',
      })
      .execute();
  }

  private async resolver(tipo: TipoAlerta, referenciaId: string) {
    await this.alertas.update(
      { tipo, referenciaId, resuelta: false },
      { resuelta: true, resueltaEn: new Date() },
    );
  }
}
