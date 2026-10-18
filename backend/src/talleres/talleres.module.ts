import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Taller } from './taller.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Taller])],
  exports: [TypeOrmModule],
})
export class TalleresModule {}
