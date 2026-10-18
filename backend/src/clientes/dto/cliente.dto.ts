import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateClienteDto {
  /** Opcional: lo envía el frontend cuando el cliente se registró sin conexión. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(120)
  nombre: string;

  @Transform(trim)
  @IsOptional()
  @Matches(/^[0-9A-Za-z-]{4,20}$/, { message: 'CI/NIT inválido' })
  ciNit?: string | null;

  @Transform(trim)
  @Matches(/^[0-9+\s-]{7,20}$/, { message: 'Teléfono inválido' })
  telefono: string;

  @Transform(trim)
  @IsOptional()
  @IsEmail({}, { message: 'Correo inválido' })
  email?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string | null;
}

export class UpdateClienteDto extends PartialType(OmitType(CreateClienteDto, ['id'] as const)) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
