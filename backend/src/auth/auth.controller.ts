import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser,
  Public,
  UsuarioActual,
} from '../common/decorators/auth.decorators';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly usuarios: UsuariosService,
  ) {}

  /** Máximo 5 intentos por minuto desde la misma IP (fuerza bruta). */
  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** Perfil del usuario autenticado (incluye el estado de la suscripción). */
  @Get('me')
  @SkipThrottle()
  me(@CurrentUser() user: UsuarioActual) {
    return this.usuarios.perfil(user.id);
  }
}
