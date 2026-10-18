import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export const METODOS_SUSCRIPCION = ['EFECTIVO', 'QR', 'TRANSFERENCIA'];

class AdminInicialDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Correo del administrador inválido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña inicial debe tener al menos 8 caracteres' })
  password: string;
}

class DatosTallerDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nit?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactoNombre?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  notas?: string | null;
}

/** HU-25: alta de un taller cliente con su administrador. */
export class CrearTallerDto extends DatosTallerDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre: string;

  /** Período de prueba gratuito. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  diasPrueba?: number;

  @ValidateNested()
  @Type(() => AdminInicialDto)
  admin: AdminInicialDto;
}

export class ActualizarTallerDto extends DatosTallerDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre?: string;
}

/** HU-26: registrar el pago de la suscripción. */
export class PagoSuscripcionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  meses: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto: number;

  @IsIn(METODOS_SUSCRIPCION)
  metodo: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  referencia?: string | null;
}

export class SuspenderDto {
  @Transform(trim)
  @IsString({ message: 'Indique el motivo' })
  @MinLength(3, { message: 'Indique el motivo' })
  @MaxLength(200)
  motivo: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;
}
