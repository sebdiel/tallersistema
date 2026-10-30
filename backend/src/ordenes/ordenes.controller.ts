import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Roles, UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import {
  AgregarManoObraDto,
  AgregarRepuestoDto,
  AnularPagoDto,
  AsignarMecanicoDto,
  CambiarEstadoDto,
  CreateOrdenDto,
  DescuentoDto,
  FiltroOrdenesDto,
  RegistrarPagoDto,
  UpdateOrdenDto,
} from './dto/orden.dto';
import { OrdenesService } from './ordenes.service';

@Controller('ordenes')
@Roles(Rol.ADMIN, Rol.MECANICO)
export class OrdenesController {
  constructor(private readonly service: OrdenesService) {}

  @Get()
  listar(@CurrentUser() user: UsuarioActual, @Query() filtro: FiltroOrdenesDto) {
    return this.service.listar(user, filtro);
  }

  @Get('resumen')
  resumen(@CurrentUser() user: UsuarioActual) {
    return this.service.resumen(user);
  }

  @Get(':id')
  obtener(@CurrentUser() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(user, id);
  }

  @Post()
  crear(@CurrentUser() user: UsuarioActual, @Body() dto: CreateOrdenDto) {
    return this.service.crear(user, dto);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrdenDto,
  ) {
    return this.service.actualizar(user, id, dto);
  }

  @Patch(':id/mecanico')
  asignarMecanico(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AsignarMecanicoDto,
  ) {
    return this.service.asignarMecanico(user, id, dto);
  }

  @Post(':id/estado')
  cambiarEstado(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoDto,
  ) {
    return this.service.cambiarEstado(user, id, dto);
  }

  @Post(':id/repuestos')
  agregarRepuesto(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AgregarRepuestoDto,
  ) {
    return this.service.agregarRepuesto(user, id, dto);
  }

  @Delete(':id/repuestos/:lineaId')
  quitarRepuesto(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineaId', ParseUUIDPipe) lineaId: string,
  ) {
    return this.service.quitarRepuesto(user, id, lineaId);
  }

  // ---------------------------------------------------------------- Iteración 3

  @Post(':id/mano-obra')
  agregarManoObra(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AgregarManoObraDto,
  ) {
    return this.service.agregarManoObra(user, id, dto);
  }

  @Delete(':id/mano-obra/:lineaId')
  quitarManoObra(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineaId', ParseUUIDPipe) lineaId: string,
  ) {
    return this.service.quitarManoObra(user, id, lineaId);
  }

  @Patch(':id/descuento')
  @Roles(Rol.ADMIN)
  aplicarDescuento(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DescuentoDto,
  ) {
    return this.service.aplicarDescuento(user, id, dto);
  }

  @Post(':id/pagos')
  registrarPago(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarPagoDto,
  ) {
    return this.service.registrarPago(user, id, dto);
  }

  @Post(':id/pagos/:pagoId/anular')
  @Roles(Rol.ADMIN)
  anularPago(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pagoId', ParseUUIDPipe) pagoId: string,
    @Body() dto: AnularPagoDto,
  ) {
    return this.service.anularPago(user, id, pagoId, dto);
  }
}
