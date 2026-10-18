import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  Roles,
  UsuarioActual,
} from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';

@Controller('clientes')
@Roles(Rol.ADMIN, Rol.MECANICO)
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Get()
  buscar(
    @CurrentUser() user: UsuarioActual,
    @Query('q') q?: string,
    @Query('inactivos') inactivos?: string,
  ) {
    return this.service.buscar(user, q, inactivos === 'true');
  }

  @Get(':id')
  obtener(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.obtener(user, id);
  }

  @Post()
  crear(@CurrentUser() user: UsuarioActual, @Body() dto: CreateClienteDto) {
    return this.service.crear(user, dto);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClienteDto,
  ) {
    return this.service.actualizar(user, id, dto);
  }

  @Delete(':id')
  @Roles(Rol.ADMIN)
  @HttpCode(204)
  eliminar(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.eliminar(user, id);
  }
}
