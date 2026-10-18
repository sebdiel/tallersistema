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
  AgregarRepuestoDto,
  AsignarMecanicoDto,
  CambiarEstadoDto,
  CreateOrdenDto,
  FiltroOrdenesDto,
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
  @Roles(Rol.ADMIN)
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
}
