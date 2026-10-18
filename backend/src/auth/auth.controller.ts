import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  CurrentUser,
  Public,
  UsuarioActual,
} from '../common/decorators/auth.decorators';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly usuarios: UsuariosService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** Perfil del usuario autenticado. */
  @Get('me')
  me(@CurrentUser() user: UsuarioActual) {
    return this.usuarios.perfil(user.id);
  }
}
