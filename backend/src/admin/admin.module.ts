import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alerta } from '../reglas/alerta.entity';
import { Taller } from '../talleres/taller.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PagoSuscripcion } from './pago-suscripcion.entity';
import { SuscripcionesTareas } from './suscripciones.tareas';

@Module({
  imports: [TypeOrmModule.forFeature([Taller, Usuario, PagoSuscripcion, Alerta])],
  controllers: [AdminController],
  providers: [AdminService, SuscripcionesTareas],
})
export class AdminModule {}
