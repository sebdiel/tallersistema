import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alerta, TipoAlerta } from '../reglas/alerta.entity';
import { Taller } from '../talleres/taller.entity';
import { estadoSuscripcion } from './suscripcion';

/**
 * HU-27: regla automatizada por tiempo. Todos los días a las 07:00 (hora de
 * Bolivia) avisa a cada taller cuya suscripción está por vencer o en período
 * de gracia; el aviso aparece en la pantalla de inicio de su administrador.
 * El bloqueo en sí no necesita esta tarea: se evalúa en cada inicio de sesión
 * y en cada petición (RN-22).
 */
@Injectable()
export class SuscripcionesTareas implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuscripcionesTareas.name);

  constructor(
    @InjectRepository(Taller) private readonly talleres: Repository<Taller>,
    @InjectRepository(Alerta) private readonly alertas: Repository<Alerta>,
  ) {}

  onApplicationBootstrap() {
    // Al desplegar o reiniciar, no esperar al día siguiente.
    this.revisarVencimientos().catch((e) => this.logger.error('Revisión inicial', e));
  }

  @Cron('0 7 * * *', { timeZone: 'America/La_Paz' })
  async revisarVencimientos() {
    const talleres = await this.talleres.find();
    let avisos = 0;
    for (const t of talleres) {
      const s = estadoSuscripcion(t);
      if (s.estado === 'POR_VENCER' || s.estado === 'EN_GRACIA') {
        await this.alertas
          .createQueryBuilder()
          .insert()
          .values({ tallerId: t.id, tipo: TipoAlerta.SUSCRIPCION, referenciaId: t.id, mensaje: s.mensaje! })
          .orUpdate(['mensaje'], ['tipo', 'referencia_id'], { indexPredicate: 'resuelta = false' })
          .execute();
        avisos++;
      } else {
        await this.alertas.update(
          { tipo: TipoAlerta.SUSCRIPCION, referenciaId: t.id, resuelta: false },
          { resuelta: true, resueltaEn: new Date() },
        );
      }
    }
    this.logger.log(`Vencimientos revisados: ${talleres.length} talleres, ${avisos} aviso(s)`);
    return { talleres: talleres.length, avisos };
  }
}
