import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Taller } from './taller.entity';
import { TalleresController } from './talleres.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Taller])],
  controllers: [TalleresController],
  exports: [TypeOrmModule],
})
export class TalleresModule {}
