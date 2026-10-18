import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { SeedService } from './database/seed.service';
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
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: +config.get('DB_PORT', 5432),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        // Solo en desarrollo. En producción (Iteración 4) se usan migraciones.
        synchronize: config.get('DB_SYNC') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([Usuario, Taller]),
    TalleresModule,
    UsuariosModule,
    AuthModule,
    ClientesModule,
    VehiculosModule,
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
