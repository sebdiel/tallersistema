import { Body, Controller, Get, NotFoundException, Patch } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser, Roles, UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { tallerDe } from '../common/utils/taller.util';
import { Taller } from './taller.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

class UpdateTallerDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string | null;
}

/** Datos del propio taller (aparecen en el comprobante). */
@Controller('taller')
@Roles(Rol.ADMIN, Rol.MECANICO)
export class TalleresController {
  constructor(@InjectRepository(Taller) private readonly repo: Repository<Taller>) {}

  @Get()
  async obtener(@CurrentUser() user: UsuarioActual) {
    const taller = await this.repo.findOneBy({ id: tallerDe(user) });
    if (!taller) throw new NotFoundException('Taller no encontrado');
    return taller;
  }

  @Patch()
  @Roles(Rol.ADMIN)
  async actualizar(@CurrentUser() user: UsuarioActual, @Body() dto: UpdateTallerDto) {
    const taller = await this.obtener(user);
    return this.repo.save({ ...taller, ...dto });
  }
}
