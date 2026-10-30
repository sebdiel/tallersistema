import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { CurrentUser, Roles, UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { tallerDe } from '../common/utils/taller.util';
import { CreateServicioDto, UpdateServicioDto } from './dto/servicio.dto';
import { Servicio } from './servicio.entity';

/** Catálogo de servicios: todos lo consultan, el administrador lo mantiene. */
@Controller('servicios')
@Roles(Rol.ADMIN, Rol.MECANICO)
export class ServiciosController {
  constructor(
    @InjectRepository(Servicio) private readonly repo: Repository<Servicio>,
    private readonly db: DataSource,
  ) {}

  /** Mano de obra libre que se repite en órdenes y aún no está en el catálogo. */
  @Get('frecuentes')
  @Roles(Rol.ADMIN)
  async frecuentes(@CurrentUser() user: UsuarioActual) {
    return this.db.query(
      `SELECT MIN(m.descripcion) AS nombre, COUNT(*)::int AS frecuencia,
              ROUND(AVG(m.monto), 2)::numeric AS precio_sugerido
         FROM orden_mano_obra m
         JOIN ordenes_trabajo o ON o.id = m.orden_id
        WHERE o.taller_id = $1 AND m.servicio_id IS NULL AND TRIM(m.descripcion) <> ''
          AND CHAR_LENGTH(TRIM(m.descripcion)) <= 120
          AND NOT EXISTS (
            SELECT 1 FROM servicios s
             WHERE s.taller_id = $1 AND LOWER(TRIM(s.nombre)) = LOWER(TRIM(m.descripcion))
          )
        GROUP BY LOWER(TRIM(m.descripcion))
       HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC, MIN(m.descripcion) ASC
        LIMIT 10`,
      [tallerDe(user)],
    );
  }

  @Get()
  listar(@CurrentUser() user: UsuarioActual, @Query('inactivos') inactivos?: string) {
    return this.repo.find({
      where: { tallerId: tallerDe(user), ...(inactivos === 'true' ? {} : { activo: true }) },
      order: { nombre: 'ASC' },
    });
  }

  @Post()
  @Roles(Rol.ADMIN)
  async crear(@CurrentUser() user: UsuarioActual, @Body() dto: CreateServicioDto) {
    const tallerId = tallerDe(user);
    await this.verificarNombre(tallerId, dto.nombre);
    return this.repo.save(this.repo.create({ ...dto, tallerId }));
  }

  @Patch(':id')
  @Roles(Rol.ADMIN)
  async actualizar(
    @CurrentUser() user: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServicioDto,
  ) {
    const servicio = await this.repo.findOne({ where: { id, tallerId: tallerDe(user) } });
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    if (dto.nombre && dto.nombre !== servicio.nombre) {
      await this.verificarNombre(servicio.tallerId, dto.nombre);
    }
    return this.repo.save({ ...servicio, ...dto });
  }

  private async verificarNombre(tallerId: string, nombre: string) {
    if (await this.repo.exists({ where: { tallerId, nombre } })) {
      throw new ConflictException('Ya existe un servicio con ese nombre');
    }
  }
}
