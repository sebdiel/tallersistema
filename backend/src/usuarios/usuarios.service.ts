import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { estadoSuscripcion } from '../admin/suscripcion';
import { UsuarioActual } from '../common/decorators/auth.decorators';
import { tallerDe } from '../common/utils/taller.util';
import { CreateUsuarioDto, UpdateUsuarioDto } from './dto/usuario.dto';
import { Usuario } from './usuario.entity';

const SALT_ROUNDS = 10;

/** HU-02: gestión de usuarios del taller (solo ADMIN). */
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
  ) {}

  /** Perfil + estado de la suscripción del taller (para el aviso de vencimiento). */
  async perfil(id: string) {
    const u = await this.repo.findOne({ where: { id }, relations: { taller: true } });
    if (!u) return null;
    return {
      ...u,
      taller: u.taller ? { ...u.taller, suscripcion: estadoSuscripcion(u.taller) } : null,
    };
  }

  listar(user: UsuarioActual) {
    return this.repo.find({
      where: { tallerId: tallerDe(user) },
      order: { nombre: 'ASC' },
    });
  }

  async obtener(user: UsuarioActual, id: string) {
    const usuario = await this.repo.findOne({
      where: { id, tallerId: tallerDe(user) },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async crear(user: UsuarioActual, dto: CreateUsuarioDto) {
    const email = dto.email.trim().toLowerCase();
    await this.verificarEmailLibre(email);

    const usuario = this.repo.create({
      nombre: dto.nombre.trim(),
      email,
      rol: dto.rol,
      tallerId: tallerDe(user),
      passwordHash: await bcrypt.hash(dto.password, SALT_ROUNDS),
    });
    const { id } = await this.repo.save(usuario);
    return this.obtener(user, id);
  }

  async actualizar(user: UsuarioActual, id: string, dto: UpdateUsuarioDto) {
    const usuario = await this.obtener(user, id);

    // Un admin no puede quitarse a sí mismo el rol ni desactivarse:
    // dejaría al taller sin nadie que pueda administrarlo.
    if (id === user.id && (dto.activo === false || (dto.rol && dto.rol !== usuario.rol))) {
      throw new BadRequestException('No puede desactivarse ni cambiar su propio rol');
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      if (email !== usuario.email) await this.verificarEmailLibre(email);
      usuario.email = email;
    }
    if (dto.nombre) usuario.nombre = dto.nombre.trim();
    if (dto.rol) usuario.rol = dto.rol;
    if (dto.activo !== undefined) usuario.activo = dto.activo;
    if (dto.password) {
      usuario.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    await this.repo.save(usuario);
    return this.obtener(user, id);
  }

  private async verificarEmailLibre(email: string) {
    if (await this.repo.exists({ where: { email } })) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }
  }
}
