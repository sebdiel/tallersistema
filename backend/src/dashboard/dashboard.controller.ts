import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, Matches } from 'class-validator';
import { CurrentUser, Roles, UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { tallerDe } from '../common/utils/taller.util';
import { DashboardService } from './dashboard.service';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

class RangoDto {
  @IsOptional()
  @Matches(FECHA, { message: 'Fecha "desde" inválida (AAAA-MM-DD)' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA, { message: 'Fecha "hasta" inválida (AAAA-MM-DD)' })
  hasta?: string;
}

/** HU-22 a HU-24: panel de indicadores (solo el administrador / dueño). */
@Controller('dashboard')
@Roles(Rol.ADMIN)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  kpis(@CurrentUser() user: UsuarioActual, @Query() rango: RangoDto) {
    // Por defecto: últimos 30 días (hora de Bolivia, UTC−4).
    const hoy = new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10);
    const hasta = rango.hasta ?? hoy;
    const desde =
      rango.desde ?? new Date(Date.parse(hasta) - 29 * 86_400_000).toISOString().slice(0, 10);
    return this.service.kpis(tallerDe(user), desde, hasta);
  }
}
