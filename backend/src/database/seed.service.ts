import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Rol } from '../common/enums/rol.enum';
import { Taller } from '../talleres/taller.entity';
import { Usuario } from '../usuarios/usuario.entity';

/**
 * Crea los datos mínimos para poder ingresar al sistema la primera vez:
 * un SUPERADMIN, un taller de prueba y su ADMIN. Solo se ejecuta si la tabla
 * de usuarios está vacía.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Taller) private readonly talleres: Repository<Taller>,
  ) {}

  async onApplicationBootstrap() {
    if ((await this.usuarios.count()) > 0) return;

    const superEmail = this.config.get('SEED_SUPERADMIN_EMAIL', 'superadmin@taller.bo');
    await this.usuarios.save(
      this.usuarios.create({
        nombre: 'Super Administrador',
        email: superEmail,
        rol: Rol.SUPERADMIN,
        tallerId: null,
        passwordHash: await bcrypt.hash(
          this.config.get('SEED_SUPERADMIN_PASSWORD', 'SuperAdmin123'),
          10,
        ),
      }),
    );

    // En producción (SEED_DEMO=false) los talleres los crea el SUPERADMIN.
    if (this.config.get('SEED_DEMO', 'true') !== 'true') {
      this.logger.log(`SUPERADMIN inicial creado: ${superEmail}`);
      return;
    }

    const taller = await this.talleres.save(
      this.talleres.create({
        nombre: this.config.get('SEED_TALLER_NOMBRE', 'Taller Demo'),
      }),
    );
    const adminEmail = this.config.get('SEED_ADMIN_EMAIL', 'admin@taller.bo');
    await this.usuarios.save(
      this.usuarios.create({
        nombre: 'Administrador del Taller',
        email: adminEmail,
        rol: Rol.ADMIN,
        tallerId: taller.id,
        passwordHash: await bcrypt.hash(
          this.config.get('SEED_ADMIN_PASSWORD', 'Admin123'),
          10,
        ),
      }),
    );

    this.logger.log(`Datos iniciales creados: ${superEmail}, ${adminEmail}`);
  }
}
