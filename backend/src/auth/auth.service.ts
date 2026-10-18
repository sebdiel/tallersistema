import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { estadoSuscripcion } from '../admin/suscripcion';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UsuarioActual } from '../common/decorators/auth.decorators';
import { Usuario } from '../usuarios/usuario.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwt: JwtService,
  ) {}

  /** HU-01: inicio de sesión con correo y contraseña. */
  async login(dto: LoginDto) {
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .leftJoinAndSelect('u.taller', 't')
      .where('LOWER(u.email) = LOWER(:email)', { email: dto.email })
      .getOne();

    const credencialesOk =
      !!usuario && (await bcrypt.compare(dto.password, usuario.passwordHash));
    if (!credencialesOk) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    // RN-03: usuario desactivado no puede ingresar.
    if (!usuario.activo) {
      throw new UnauthorizedException('Usuario desactivado. Contacte al administrador');
    }
    // RN-22: taller suspendido o con la suscripción vencida (pasada la gracia).
    const suscripcion = usuario.taller ? estadoSuscripcion(usuario.taller) : null;
    if (suscripcion && !suscripcion.habilitado) {
      throw new ForbiddenException(suscripcion.mensaje);
    }

    const payload: UsuarioActual = {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      tallerId: usuario.tallerId,
    };

    return {
      accessToken: await this.jwt.signAsync({ sub: usuario.id, ...payload }),
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        taller: usuario.taller
          ? { id: usuario.taller.id, nombre: usuario.taller.nombre, suscripcion }
          : null,
      },
    };
  }
}
