import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles, UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { AdminService } from './admin.service';
import {
  ActualizarTallerDto,
  CrearTallerDto,
  PagoSuscripcionDto,
  ResetPasswordDto,
  SuspenderDto,
} from './dto/admin.dto';
import { SuscripcionesTareas } from './suscripciones.tareas';

/** Administración global del sistema comercial (HU-25 a HU-28). */
@Controller('admin')
@Roles(Rol.SUPERADMIN)
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly tareas: SuscripcionesTareas,
  ) {}

  @Get('resumen')
  resumen() {
    return this.service.resumen();
  }

  @Get('talleres')
  listar() {
    return this.service.listarTalleres();
  }

  @Get('talleres/:id')
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detalle(id);
  }

  @Post('talleres')
  crear(@Body() dto: CrearTallerDto) {
    return this.service.crearTaller(dto);
  }

  @Patch('talleres/:id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarTallerDto) {
    return this.service.actualizarTaller(id, dto);
  }

  @Post('talleres/:id/pagos')
  registrarPago(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PagoSuscripcionDto,
  ) {
    return this.service.registrarPago(user, id, dto);
  }

  @Post('talleres/:id/suspender')
  suspender(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SuspenderDto) {
    return this.service.suspender(id, dto);
  }

  @Post('talleres/:id/reactivar')
  reactivar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivar(id);
  }

  @Post('talleres/:id/usuarios/:usuarioId/password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.service.resetPassword(id, usuarioId, dto);
  }

  /** Ejecuta ya la revisión diaria de vencimientos (normalmente corre a las 07:00). */
  @Post('tareas/revisar-vencimientos')
  revisar() {
    return this.tareas.revisarVencimientos();
  }
}
