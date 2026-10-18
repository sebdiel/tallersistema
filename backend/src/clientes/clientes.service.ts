import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioActual } from '../common/decorators/auth.decorators';
import { tallerDe } from '../common/utils/taller.util';
import { Vehiculo } from '../vehiculos/vehiculo.entity';
import { Cliente } from './cliente.entity';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente) private readonly repo: Repository<Cliente>,
    @InjectRepository(Vehiculo) private readonly vehiculos: Repository<Vehiculo>,
  ) {}

  /** HU-05: búsqueda por nombre, CI/NIT o teléfono. */
  buscar(user: UsuarioActual, q?: string, incluirInactivos = false, limite = 50) {
    const qb = this.repo
      .createQueryBuilder('c')
      .loadRelationCountAndMap('c.totalVehiculos', 'c.vehiculos')
      .where('c.taller_id = :tallerId', { tallerId: tallerDe(user) })
      .orderBy('c.nombre', 'ASC')
      .take(limite);

    if (!incluirInactivos) qb.andWhere('c.activo = true');
    if (q?.trim()) {
      qb.andWhere(
        '(c.nombre ILIKE :q OR c.ci_nit ILIKE :q OR c.telefono ILIKE :q)',
        { q: `%${q.trim()}%` },
      );
    }
    return qb.getMany();
  }

  async obtener(user: UsuarioActual, id: string) {
    const cliente = await this.repo.findOne({
      where: { id, tallerId: tallerDe(user) },
      relations: { vehiculos: true },
      order: { vehiculos: { placa: 'ASC' } },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  async crear(user: UsuarioActual, dto: CreateClienteDto) {
    const tallerId = tallerDe(user);
    if (dto.id && (await this.repo.exists({ where: { id: dto.id } }))) {
      throw new ConflictException('El cliente ya fue registrado');
    }
    if (dto.ciNit) await this.verificarCiLibre(tallerId, dto.ciNit);
    const { id } = await this.repo.save(this.repo.create({ ...dto, tallerId }));
    return this.obtener(user, id);
  }

  async actualizar(user: UsuarioActual, id: string, dto: UpdateClienteDto) {
    const cliente = await this.obtener(user, id);
    if (dto.ciNit && dto.ciNit !== cliente.ciNit) {
      await this.verificarCiLibre(cliente.tallerId, dto.ciNit);
    }
    const { vehiculos: _, ...datos } = cliente;
    await this.repo.save({ ...datos, ...dto });
    return this.obtener(user, id);
  }

  /** RN-04: un cliente con vehículos no se elimina; se debe desactivar. */
  async eliminar(user: UsuarioActual, id: string) {
    const cliente = await this.obtener(user, id);
    const tieneVehiculos = await this.vehiculos.exists({
      where: { clienteId: cliente.id },
    });
    if (tieneVehiculos) {
      throw new ConflictException(
        'El cliente tiene vehículos registrados. Desactívelo en lugar de eliminarlo',
      );
    }
    await this.repo.delete(cliente.id);
  }

  private async verificarCiLibre(tallerId: string, ciNit: string) {
    if (await this.repo.exists({ where: { tallerId, ciNit } })) {
      throw new ConflictException('Ya existe un cliente con ese CI/NIT');
    }
  }
}
