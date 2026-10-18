import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { Vehiculo } from './vehiculo.entity';
import { VehiculosController } from './vehiculos.controller';
import { VehiculosService } from './vehiculos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vehiculo, Cliente])],
  controllers: [VehiculosController],
  providers: [VehiculosService],
})
export class VehiculosModule {}
