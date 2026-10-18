import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repuesto } from '../repuestos/repuesto.entity';
import { Alerta } from './alerta.entity';
import { AlertasController } from './alertas.controller';
import { ReglasListener } from './reglas.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Alerta, Repuesto])],
  controllers: [AlertasController],
  providers: [ReglasListener],
})
export class ReglasModule {}
