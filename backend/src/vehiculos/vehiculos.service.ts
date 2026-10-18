import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { UsuarioActual } from '../common/decorators/auth.decorators';
import { normalizarPlaca } from '../common/utils/placa.util';
import { tallerDe } from '../common/utils/taller.util';
import { OrdenTrabajo } from '../ordenes/orden.entity';
import { CreateVehiculoDto, UpdateVehiculoDto } from './dto/vehiculo.dto';
import { Vehiculo } from './vehiculo.entity';

@Injectable()
export class VehiculosService {
  constructor(
    @InjectRepository(Vehiculo) private readonly repo: Repository<Vehiculo>,
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    @InjectRepository(OrdenTrabajo) private readonly ordenes: Repository<OrdenTrabajo>,
  ) {}

  /** HU-07: búsqueda por placa (parcial), marca o modelo. */
  buscar(user: UsuarioActual, q?: string, limite = 50) {
    const qb = this.repo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.cliente', 'c')
      .where('v.taller_id = :tallerId', { tallerId: tallerDe(user) })
      .orderBy('v.placa', 'ASC')
      .take(limite);

    if (q?.trim()) {
      qb.andWhere('(v.placa ILIKE :placa OR v.marca ILIKE :q OR v.modelo ILIKE :q)', {
        placa: `%${normalizarPlaca(q)}%`,
        q: `%${q.trim()}%`,
      });
    }
    return qb.getMany();
  }

  async obtener(user: UsuarioActual, id: string) {
    const vehiculo = await this.repo.findOne({
      where: { id, tallerId: tallerDe(user) },
      relations: { cliente: true },
    });
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado');
    return vehiculo;
  }

  /** HU-07: ficha técnica + historial de órdenes de trabajo del vehículo. */
  async ficha(user: UsuarioActual, id: string) {
    const vehiculo = await this.obtener(user, id);
    const historial = await this.ordenes.find({
      where: { vehiculoId: id },
      relations: { mecanico: true, repuestos: { repuesto: true } },
      order: { fechaIngreso: 'DESC' },
    });
    return { vehiculo, historial };
  }

  async crear(user: UsuarioActual, dto: CreateVehiculoDto) {
    const tallerId = tallerDe(user);
    if (dto.id && (await this.repo.exists({ where: { id: dto.id } }))) {
      throw new ConflictException('El vehículo ya fue registrado');
    }
    await this.verificarCliente(tallerId, dto.clienteId);
    await this.verificarPlacaLibre(tallerId, dto.placa);
    const { id } = await this.repo.save(this.repo.create({ ...dto, tallerId }));
    return this.obtener(user, id);
  }

  async actualizar(user: UsuarioActual, id: string, dto: UpdateVehiculoDto) {
    const vehiculo = await this.obtener(user, id);
    if (dto.clienteId && dto.clienteId !== vehiculo.clienteId) {
      await this.verificarCliente(vehiculo.tallerId, dto.clienteId);
    }
    if (dto.placa && dto.placa !== vehiculo.placa) {
      await this.verificarPlacaLibre(vehiculo.tallerId, dto.placa);
    }
    if (dto.kilometraje !== undefined && dto.kilometraje < vehiculo.kilometraje) {
      throw new BadRequestException(
        `El kilometraje no puede ser menor al registrado (${vehiculo.kilometraje} km)`,
      );
    }
    const { cliente: _, ...datos } = vehiculo;
    await this.repo.save({ ...datos, ...dto });
    return this.obtener(user, id);
  }

  private async verificarCliente(tallerId: string, clienteId: string) {
    const cliente = await this.clientes.findOne({
      where: { id: clienteId, tallerId },
    });
    if (!cliente) throw new BadRequestException('El cliente no existe');
    if (!cliente.activo) {
      throw new BadRequestException('El cliente está desactivado');
    }
  }

  /** RN-01: la placa es única dentro del taller. */
  private async verificarPlacaLibre(tallerId: string, placa: string) {
    if (await this.repo.exists({ where: { tallerId, placa } })) {
      throw new ConflictException('La placa ya está registrada');
    }
  }
}
