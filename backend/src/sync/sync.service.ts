import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { CreateClienteDto } from '../clientes/dto/cliente.dto';
import { ClientesService } from '../clientes/clientes.service';
import { UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { tallerDe } from '../common/utils/taller.util';
import {
  AgregarRepuestoDto,
  AsignarMecanicoDto,
  CambiarEstadoDto,
  CreateOrdenDto,
  UpdateOrdenDto,
} from '../ordenes/dto/orden.dto';
import { OrdenesService } from '../ordenes/ordenes.service';
import { RepuestosService } from '../repuestos/repuestos.service';
import { Usuario } from '../usuarios/usuario.entity';
import { CreateVehiculoDto } from '../vehiculos/dto/vehiculo.dto';
import { VehiculosService } from '../vehiculos/vehiculos.service';
import { OperacionDto, ResultadoOperacion } from './sync.dto';
import { SyncOperacion } from './sync-operacion.entity';

/** HU-16: aplica en el servidor las operaciones registradas sin conexión. */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncOperacion) private readonly registro: Repository<SyncOperacion>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly clientes: ClientesService,
    private readonly vehiculos: VehiculosService,
    private readonly ordenes: OrdenesService,
    private readonly repuestos: RepuestosService,
  ) {}

  /**
   * Procesa las operaciones en el mismo orden en que se hicieron. Un error de
   * negocio (p. ej. stock insuficiente) se registra como conflicto y se sigue
   * con la siguiente; un error del servidor detiene el lote para reintentar.
   */
  async sincronizar(user: UsuarioActual, operaciones: OperacionDto[]) {
    const tallerId = tallerDe(user);
    const resultados: ResultadoOperacion[] = [];

    for (const op of operaciones) {
      const previa = await this.registro.findOne({ where: { id: op.id, tallerId } });
      if (previa) {
        resultados.push({ id: op.id, ok: previa.ok, error: previa.error ?? undefined });
        continue;
      }

      try {
        await this.ejecutar(user, op);
        await this.guardar(user, op, true, null);
        resultados.push({ id: op.id, ok: true });
      } catch (err) {
        if (err instanceof HttpException && err.getStatus() < 500) {
          const error = mensaje(err);
          await this.guardar(user, op, false, error);
          resultados.push({ id: op.id, ok: false, error });
        } else {
          this.logger.error(`Fallo procesando operación ${op.tipo}`, err as Error);
          resultados.push({ id: op.id, ok: false, error: 'Error del servidor', reintentar: true });
          break;
        }
      }
    }
    return { resultados };
  }

  /**
   * Copia de los datos que el dispositivo necesita para trabajar sin conexión.
   */
  async snapshot(user: UsuarioActual) {
    const tallerId = tallerDe(user);
    const [clientes, vehiculos, repuestos, abiertas, recientes, personal] = await Promise.all([
      this.clientes.buscar(user, undefined, false, 10_000),
      this.vehiculos.buscar(user, undefined, 10_000),
      this.repuestos.buscar(user),
      this.ordenes.listar(user, { abiertas: true }),
      this.ordenes.listar(user, {}),
      this.usuarios.find({
        where: { tallerId, activo: true },
        select: { id: true, nombre: true, rol: true },
        order: { nombre: 'ASC' },
      }),
    ]);
    const ordenes = [...new Map([...recientes, ...abiertas].map((o) => [o.id, o])).values()];
    return { generadoEn: new Date(), clientes, vehiculos, repuestos, ordenes, personal };
  }

  private async ejecutar(user: UsuarioActual, op: OperacionDto) {
    const ref = () => {
      if (!op.ref) throw new BadRequestException('Falta la orden de referencia');
      return op.ref;
    };

    switch (op.tipo) {
      case 'cliente.crear':
        return this.clientes.crear(user, await validar(CreateClienteDto, op.datos));
      case 'vehiculo.crear':
        return this.vehiculos.crear(user, await validar(CreateVehiculoDto, op.datos));
      case 'orden.crear':
        return this.ordenes.crear(user, await validar(CreateOrdenDto, op.datos));
      case 'orden.actualizar':
        return this.ordenes.actualizar(user, ref(), await validar(UpdateOrdenDto, op.datos));
      case 'orden.mecanico':
        if (user.rol !== Rol.ADMIN) throw new ForbiddenException('Solo el administrador asigna mecánicos');
        return this.ordenes.asignarMecanico(user, ref(), await validar(AsignarMecanicoDto, op.datos));
      case 'orden.estado':
        return this.ordenes.cambiarEstado(user, ref(), await validar(CambiarEstadoDto, op.datos));
      case 'orden.repuesto.agregar':
        return this.ordenes.agregarRepuesto(user, ref(), await validar(AgregarRepuestoDto, op.datos));
      case 'orden.repuesto.quitar': {
        const lineaId = op.datos['lineaId'];
        if (typeof lineaId !== 'string') throw new BadRequestException('Falta lineaId');
        return this.ordenes.quitarRepuesto(user, ref(), lineaId);
      }
    }
  }

  private guardar(user: UsuarioActual, op: OperacionDto, ok: boolean, error: string | null) {
    return this.registro.insert({
      id: op.id,
      tallerId: tallerDe(user),
      usuarioId: user.id,
      tipo: op.tipo,
      ok,
      error,
      creadaEn: op.creadaEn,
    });
  }
}

/** Misma validación que el ValidationPipe global, aplicada a cada operación. */
async function validar<T extends object>(clase: ClassConstructor<T>, datos: object): Promise<T> {
  const instancia = plainToInstance(clase, datos);
  const errores = await validate(instancia, { whitelist: true, forbidNonWhitelisted: true });
  if (errores.length) {
    const mensajes = errores.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new BadRequestException(mensajes.join('. '));
  }
  return instancia;
}

function mensaje(err: HttpException): string {
  const r = err.getResponse();
  if (typeof r === 'string') return r;
  const m = (r as { message?: string | string[] }).message;
  return Array.isArray(m) ? m.join('. ') : (m ?? err.message);
}
