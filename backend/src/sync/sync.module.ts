import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesModule } from '../clientes/clientes.module';
import { OrdenesModule } from '../ordenes/ordenes.module';
import { RepuestosModule } from '../repuestos/repuestos.module';
import { Servicio } from '../servicios/servicio.entity';
import { Taller } from '../talleres/taller.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { VehiculosModule } from '../vehiculos/vehiculos.module';
import { SyncController } from './sync.controller';
import { SyncOperacion } from './sync-operacion.entity';
import { SyncService } from './sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncOperacion, Usuario, Servicio, Taller]),
    ClientesModule,
    VehiculosModule,
    OrdenesModule,
    RepuestosModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
