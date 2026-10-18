import {
  Body,
  Controller,
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
  AjusteStockDto,
  CreateRepuestoDto,
  EntradaStockDto,
  UpdateRepuestoDto,
} from './dto/repuesto.dto';
import { RepuestosService } from './repuestos.service';

/** El mecánico consulta el inventario; el ADMIN lo administra. */
@Controller('repuestos')
@Roles(Rol.ADMIN, Rol.MECANICO)
export class RepuestosController {
  constructor(private readonly service: RepuestosService) {}

  @Get()
  buscar(
    @CurrentUser() user: UsuarioActual,
    @Query('q') q?: string,
    @Query('bajoStock') bajoStock?: string,
    @Query('inactivos') inactivos?: string,
  ) {
    return this.service.buscar(user, q, bajoStock === 'true', inactivos === 'true');
  }

  @Get(':id')
  detalle(@CurrentUser() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detalle(user, id);
  }

  @Post()
  @Roles(Rol.ADMIN)
  crear(@CurrentUser() user: UsuarioActual, @Body() dto: CreateRepuestoDto) {
    return this.service.crear(user, dto);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN)
  actualizar(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRepuestoDto,
  ) {
    return this.service.actualizar(user, id, dto);
  }

  @Post(':id/entradas')
  @Roles(Rol.ADMIN)
  entrada(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EntradaStockDto,
  ) {
    return this.service.registrarEntrada(user, id, dto);
  }

  @Post(':id/ajustes')
  @Roles(Rol.ADMIN)
  ajuste(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AjusteStockDto,
  ) {
    return this.service.ajustar(user, id, dto);
  }
}
