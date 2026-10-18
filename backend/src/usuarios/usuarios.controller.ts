import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CurrentUser,
  Roles,
  UsuarioActual,
} from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { CreateUsuarioDto, UpdateUsuarioDto } from './dto/usuario.dto';
import { UsuariosService } from './usuarios.service';

/** RN-02: solo el ADMIN gestiona usuarios. No hay DELETE: se desactivan. */
@Controller('usuarios')
@Roles(Rol.ADMIN)
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Get()
  listar(@CurrentUser() user: UsuarioActual) {
    return this.service.listar(user);
  }

  @Get(':id')
  obtener(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.obtener(user, id);
  }

  @Post()
  crear(@CurrentUser() user: UsuarioActual, @Body() dto: CreateUsuarioDto) {
    return this.service.crear(user, dto);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.service.actualizar(user, id, dto);
  }
}
