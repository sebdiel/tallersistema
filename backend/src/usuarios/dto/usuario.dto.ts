import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Rol } from '../../common/enums/rol.enum';

/** Roles que un ADMIN puede asignar dentro de su taller. */
export const ROLES_DE_TALLER = [Rol.ADMIN, Rol.MECANICO] as const;

export class CreateUsuarioDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre: string;

  @IsEmail({}, { message: 'Correo inválido' })
  @MaxLength(120)
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsIn(ROLES_DE_TALLER, { message: 'Rol no permitido' })
  rol: Rol;
}

export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
