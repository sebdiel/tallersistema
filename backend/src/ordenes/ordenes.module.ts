import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepuestosModule } from '../repuestos/repuestos.module';
import { HistorialEstado } from './historial-estado.entity';
import { Servicio } from '../servicios/servicio.entity';
import { OrdenManoObra } from './orden-mano-obra.entity';
import { OrdenRepuesto } from './orden-repuesto.entity';
import { OrdenRepuestoExterno } from './orden-repuesto-externo.entity';
import { Pago } from './pago.entity';
import { OrdenTrabajo } from './orden.entity';
import { OrdenesController } from './ordenes.controller';
import { OrdenesService } from './ordenes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrdenTrabajo,
      OrdenRepuesto,
      HistorialEstado,
      OrdenManoObra,
      OrdenRepuestoExterno,
      Pago,
      Servicio,
    ]),
    RepuestosModule,
  ],
  controllers: [OrdenesController],
  providers: [OrdenesService],
  exports: [OrdenesService],
})
export class OrdenesModule {}
