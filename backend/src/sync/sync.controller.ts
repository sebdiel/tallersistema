import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser, Roles, UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { SincronizarDto } from './sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@Roles(Rol.ADMIN, Rol.MECANICO)
export class SyncController {
  constructor(private readonly service: SyncService) {}

  /** Datos para trabajar offline (se guardan en IndexedDB). */
  @Get('snapshot')
  snapshot(@CurrentUser() user: UsuarioActual) {
    return this.service.snapshot(user);
  }

  /** Cola de operaciones hechas sin conexión. */
  @Post()
  @HttpCode(200)
  sincronizar(@CurrentUser() user: UsuarioActual, @Body() dto: SincronizarDto) {
    return this.service.sincronizar(user, dto.operaciones);
  }
}
