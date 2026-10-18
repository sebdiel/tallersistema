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
import {
  CurrentUser,
  Roles,
  UsuarioActual,
} from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { CreateVehiculoDto, UpdateVehiculoDto } from './dto/vehiculo.dto';
import { VehiculosService } from './vehiculos.service';

@Controller('vehiculos')
@Roles(Rol.ADMIN, Rol.MECANICO)
export class VehiculosController {
  constructor(private readonly service: VehiculosService) {}

  @Get()
  buscar(@CurrentUser() user: UsuarioActual, @Query('q') q?: string) {
    return this.service.buscar(user, q);
  }

  @Get(':id')
  ficha(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.ficha(user, id);
  }

  @Post()
  crear(@CurrentUser() user: UsuarioActual, @Body() dto: CreateVehiculoDto) {
    return this.service.crear(user, dto);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehiculoDto,
  ) {
    return this.service.actualizar(user, id, dto);
  }
}
