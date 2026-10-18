import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { UsuarioActual } from '../common/decorators/auth.decorators';
import { Rol } from '../common/enums/rol.enum';
import { Alerta, TipoAlerta } from '../reglas/alerta.entity';
import { Taller } from '../talleres/taller.entity';
import { Usuario } from '../usuarios/usuario.entity';
import {
  ActualizarTallerDto,
  CrearTallerDto,
  PagoSuscripcionDto,
  ResetPasswordDto,
  SuspenderDto,
} from './dto/admin.dto';
import { PagoSuscripcion } from './pago-suscripcion.entity';
import {
  InfoSuscripcion,
  estadoSuscripcion,
  hoyBolivia,
  nuevaVigencia,
  sumarDias,
} from './suscripcion';

const DIAS_PRUEBA = 15;

export interface TallerResumen {
  id: string;
  nombre: string;
  telefono: string | null;
  contactoNombre: string | null;
  adminEmail: string | null;
  usuarios: number;
  ot30d: number;
  ultimaActividad: Date | null;
  createdAt: Date;
  suscripcion: InfoSuscripcion;
}

/**
 * HU-25 a HU-28: administración global del sistema comercial (solo SUPERADMIN).
 * Ve a todos los talleres pero nunca sus datos operativos (clientes, órdenes):
 * solo cifras de uso para soporte y cobranza.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService,
    @InjectRepository(Taller) private readonly talleres: Repository<Taller>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(PagoSuscripcion) private readonly pagos: Repository<PagoSuscripcion>,
    @InjectRepository(Alerta) private readonly alertas: Repository<Alerta>,
  ) {}

  private get precioMensual() {
    return Number(this.config.get('PRECIO_SUSCRIPCION', 90));
  }

  // ---------------------------------------------------------------- consultas

  async listarTalleres(): Promise<TallerResumen[]> {
    const filas = await this.db.query(
      `SELECT t.id, t.nombre, t.telefono, t.contacto_nombre, t.activo,
              to_char(t.vigente_hasta, 'YYYY-MM-DD') AS vigente_hasta, t.created_at,
              (SELECT COUNT(*) FROM usuarios u WHERE u.taller_id = t.id AND u.activo) AS usuarios,
              (SELECT u.email FROM usuarios u WHERE u.taller_id = t.id AND u.rol = 'ADMIN'
                ORDER BY u.created_at LIMIT 1) AS admin_email,
              (SELECT COUNT(*) FROM ordenes_trabajo o
                WHERE o.taller_id = t.id AND o.fecha_ingreso > now() - interval '30 days') AS ot_30d,
              (SELECT MAX(o.updated_at) FROM ordenes_trabajo o WHERE o.taller_id = t.id) AS ultima_actividad
         FROM talleres t
        ORDER BY t.nombre`,
    );
    return filas.map((f: any) => ({
      id: f.id,
      nombre: f.nombre,
      telefono: f.telefono,
      contactoNombre: f.contacto_nombre,
      adminEmail: f.admin_email,
      usuarios: Number(f.usuarios),
      ot30d: Number(f.ot_30d),
      ultimaActividad: f.ultima_actividad,
      createdAt: f.created_at,
      suscripcion: estadoSuscripcion({ activo: f.activo, vigenteHasta: f.vigente_hasta }),
    }));
  }

  /** HU-28: panel global. */
  async resumen() {
    const talleres = await this.listarTalleres();
    const porEstado = { ACTIVA: 0, POR_VENCER: 0, EN_GRACIA: 0, VENCIDA: 0, SUSPENDIDA: 0 };
    for (const t of talleres) porEstado[t.suscripcion.estado]++;
    const habilitados = talleres.filter((t) => t.suscripcion.habilitado).length;

    const [ingresos] = await this.db.query(
      `SELECT
         COALESCE(SUM(monto) FILTER (WHERE date_trunc('month', created_at AT TIME ZONE 'America/La_Paz')
                                         = date_trunc('month', now() AT TIME ZONE 'America/La_Paz')), 0) AS mes,
         COALESCE(SUM(monto) FILTER (WHERE date_trunc('month', created_at AT TIME ZONE 'America/La_Paz')
                                         = date_trunc('month', now() AT TIME ZONE 'America/La_Paz') - interval '1 month'), 0) AS mes_anterior,
         COALESCE(SUM(monto), 0) AS total
       FROM pagos_suscripcion`,
    );
    const porMes = await this.db.query(
      `SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'America/La_Paz'), 'YYYY-MM') AS mes,
              SUM(monto) AS monto, COUNT(*) AS pagos
         FROM pagos_suscripcion
        WHERE created_at > now() - interval '6 months'
        GROUP BY 1 ORDER BY 1`,
    );

    return {
      talleres: talleres.length,
      habilitados,
      porEstado,
      precioMensual: this.precioMensual,
      // Ingreso mensual recurrente estimado (talleres habilitados × precio).
      ingresoRecurrente: habilitados * this.precioMensual,
      ingresos: {
        mes: Number(ingresos.mes),
        mesAnterior: Number(ingresos.mes_anterior),
        total: Number(ingresos.total),
        porMes: porMes.map((r: any) => ({ mes: r.mes, monto: Number(r.monto), pagos: Number(r.pagos) })),
      },
      // Lo que requiere gestión de cobranza, lo más urgente primero.
      atencion: talleres
        .filter((t) => t.suscripcion.estado !== 'ACTIVA')
        .sort((a, b) => a.suscripcion.diasRestantes - b.suscripcion.diasRestantes),
    };
  }

  async detalle(id: string) {
    const taller = await this.obtener(id);
    const [usuarios, pagos, [uso]] = await Promise.all([
      this.usuarios.find({
        where: { tallerId: id },
        select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
        order: { rol: 'ASC', nombre: 'ASC' },
      }),
      this.pagos.find({
        where: { tallerId: id },
        relations: { registradoPor: true },
        order: { createdAt: 'DESC' },
      }),
      this.db.query(
        `SELECT (SELECT COUNT(*) FROM ordenes_trabajo WHERE taller_id = $1) AS ot_total,
                (SELECT COUNT(*) FROM ordenes_trabajo WHERE taller_id = $1
                   AND fecha_ingreso > now() - interval '30 days') AS ot_30d,
                (SELECT COUNT(*) FROM clientes WHERE taller_id = $1) AS clientes,
                (SELECT COUNT(*) FROM vehiculos WHERE taller_id = $1) AS vehiculos,
                (SELECT MAX(updated_at) FROM ordenes_trabajo WHERE taller_id = $1) AS ultima_actividad`,
        [id],
      ),
    ]);
    return {
      taller,
      suscripcion: estadoSuscripcion(taller),
      usuarios,
      pagos: pagos.map(({ registradoPor, ...p }) => ({
        ...p,
        registradoPor: registradoPor?.nombre ?? null,
      })),
      uso: {
        otTotal: Number(uso.ot_total),
        ot30d: Number(uso.ot_30d),
        clientes: Number(uso.clientes),
        vehiculos: Number(uso.vehiculos),
        ultimaActividad: uso.ultima_actividad,
      },
    };
  }

  // ---------------------------------------------------------------- acciones

  /** HU-25: alta de un taller cliente con su administrador y días de prueba. */
  async crearTaller(dto: CrearTallerDto) {
    const { admin, diasPrueba = DIAS_PRUEBA, ...datos } = dto;
    if (await this.usuarios.exists({ where: { email: admin.email } })) {
      throw new ConflictException('Ya existe un usuario con el correo del administrador');
    }
    const passwordHash = await bcrypt.hash(admin.password, 10);

    const id = await this.db.transaction(async (m) => {
      const taller = await m.save(
        m.create(Taller, { ...datos, vigenteHasta: sumarDias(hoyBolivia(), diasPrueba) }),
      );
      await m.save(
        m.create(Usuario, {
          nombre: admin.nombre,
          email: admin.email,
          rol: Rol.ADMIN,
          tallerId: taller.id,
          passwordHash,
        }),
      );
      return taller.id;
    });
    return this.detalle(id);
  }

  async actualizarTaller(id: string, dto: ActualizarTallerDto) {
    const taller = await this.obtener(id);
    await this.talleres.save({ ...taller, ...dto });
    return this.detalle(id);
  }

  /** HU-26 / RN-23: el pago extiende la vigencia sin perder días ya pagados. */
  async registrarPago(user: UsuarioActual, id: string, dto: PagoSuscripcionDto) {
    await this.db.transaction(async (m) => {
      const taller = await m.findOne(Taller, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!taller) throw new NotFoundException('Taller no encontrado');
      const { desde, hasta } = nuevaVigencia(taller.vigenteHasta, dto.meses);
      await m.insert(PagoSuscripcion, {
        tallerId: id,
        monto: dto.monto,
        meses: dto.meses,
        desde,
        hasta,
        metodo: dto.metodo,
        referencia: dto.referencia ?? null,
        registradoPorId: user.id,
      });
      await m.update(Taller, id, { vigenteHasta: hasta });
    });
    // El aviso de vencimiento se cierra solo al pagar.
    await this.alertas.update(
      { tipo: TipoAlerta.SUSCRIPCION, referenciaId: id, resuelta: false },
      { resuelta: true, resueltaEn: new Date() },
    );
    return this.detalle(id);
  }

  async suspender(id: string, dto: SuspenderDto) {
    const taller = await this.obtener(id);
    if (!taller.activo) throw new BadRequestException('El taller ya está suspendido');
    await this.talleres.update(id, { activo: false, motivoSuspension: dto.motivo });
    return this.detalle(id);
  }

  async reactivar(id: string) {
    const taller = await this.obtener(id);
    if (taller.activo) throw new BadRequestException('El taller ya está activo');
    await this.talleres.update(id, { activo: true, motivoSuspension: null });
    return this.detalle(id);
  }

  /** Soporte: el dueño olvidó su contraseña. */
  async resetPassword(tallerId: string, usuarioId: string, dto: ResetPasswordDto) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId, tallerId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado en el taller');
    await this.usuarios.update(usuarioId, { passwordHash: await bcrypt.hash(dto.password, 10) });
    return { ok: true };
  }

  private async obtener(id: string) {
    const taller = await this.talleres.findOneBy({ id });
    if (!taller) throw new NotFoundException('Taller no encontrado');
    return taller;
  }
}
