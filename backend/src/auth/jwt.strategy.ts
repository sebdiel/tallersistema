import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { estadoSuscripcion } from '../admin/suscripcion';
import { Repository } from 'typeorm';
import { UsuarioActual } from '../common/decorators/auth.decorators';
import { Usuario } from '../usuarios/usuario.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Se vuelve a leer el usuario en cada petición para que la desactivación
   * (RN-03) o un cambio de rol tengan efecto inmediato, sin esperar a que
   * expire el token.
   */
  async validate(payload: { sub: string }): Promise<UsuarioActual> {
    const usuario = await this.usuarios.findOne({
      where: { id: payload.sub },
      relations: { taller: true },
    });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Sesión no válida');
    }
    // RN-22: el bloqueo por suspensión o vencimiento corta también las sesiones abiertas.
    const suscripcion = usuario.taller ? estadoSuscripcion(usuario.taller) : null;
    if (suscripcion && !suscripcion.habilitado) {
      throw new UnauthorizedException(suscripcion.mensaje);
    }
    return {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      tallerId: usuario.tallerId,
    };
  }
}
