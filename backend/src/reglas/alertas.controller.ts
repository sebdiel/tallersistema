import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser, Roles, UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { tallerDe } from '../common/utils/taller.util';
import { Alerta } from './alerta.entity';

@Controller('alertas')
@Roles(Rol.ADMIN, Rol.MECANICO)
export class AlertasController {
  constructor(@InjectRepository(Alerta) private readonly repo: Repository<Alerta>) {}

  /** Alertas abiertas del taller, la más reciente primero. */
  @Get()
  listar(@CurrentUser() user: UsuarioActual) {
    return this.repo.find({
      where: { tallerId: tallerDe(user), resuelta: false },
      order: { createdAt: 'DESC' },
    });
  }

  /** Descartar manualmente (p. ej. "ya avisé al cliente"). */
  @Post(':id/resolver')
  async resolver(@CurrentUser() user: UsuarioActual, @Param('id', ParseUUIDPipe) id: string) {
    const { affected } = await this.repo.update(
      { id, tallerId: tallerDe(user), resuelta: false },
      { resuelta: true, resueltaEn: new Date() },
    );
    if (!affected) throw new NotFoundException('Alerta no encontrada');
    return { ok: true };
  }
}
