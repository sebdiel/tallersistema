import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientoInventario } from './movimiento.entity';
import { Repuesto } from './repuesto.entity';
import { RepuestosController } from './repuestos.controller';
import { RepuestosService } from './repuestos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Repuesto, MovimientoInventario])],
  controllers: [RepuestosController],
  providers: [RepuestosService],
  exports: [RepuestosService],
})
export class RepuestosModule {}
