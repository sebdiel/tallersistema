import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { SeedService } from './database/seed.service';
import { OrdenesModule } from './ordenes/ordenes.module';
import { ReglasModule } from './reglas/reglas.module';
import { RepuestosModule } from './repuestos/repuestos.module';
import { ServiciosModule } from './servicios/servicios.module';
import { SyncModule } from './sync/sync.module';
import { Taller } from './talleres/taller.entity';
import { TalleresModule } from './talleres/talleres.module';
import { Usuario } from './usuarios/usuario.entity';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VehiculosModule } from './vehiculos/vehiculos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const sincronizar = config.get('DB_SYNC') === 'true';
        return {
          type: 'postgres',
          host: config.get('DB_HOST', 'localhost'),
          port: +config.get('DB_PORT', 5432),
          username: config.get('DB_USER'),
          password: config.get('DB_PASSWORD'),
          database: config.get('DB_NAME'),
          autoLoadEntities: true,
          // Desarrollo: las tablas siguen a las entidades (DB_SYNC=true).
          // Producción: el esquema cambia solo con migraciones versionadas,
          // que se aplican solas al arrancar (Iteración 4).
          synchronize: sincronizar,
          migrations: [join(__dirname, 'database', 'migraciones', '*.js')],
          migrationsRun: !sincronizar,
        };
      },
    }),
    // Bus de eventos de dominio que alimenta el motor de reglas.
    EventEmitterModule.forRoot(),
    // Tareas programadas (revisión diaria de suscripciones).
    ScheduleModule.forRoot(),
    // Límite de peticiones (se aplica al login para frenar ataques de fuerza bruta).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    TypeOrmModule.forFeature([Usuario, Taller]),
    TalleresModule,
    UsuariosModule,
    AuthModule,
    ClientesModule,
    VehiculosModule,
    // Iteración 2
    RepuestosModule,
    OrdenesModule,
    ReglasModule,
    SyncModule,
    // Iteración 3
    ServiciosModule,
    DashboardModule,
    // Iteración 4
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    // Orden importante: primero autentica (JWT), luego verifica el rol.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    SeedService,
  ],
})
export class AppModule {}
