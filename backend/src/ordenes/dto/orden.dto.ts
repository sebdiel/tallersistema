import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EstadoOrden } from '../maquina-estados';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateOrdenDto {
  /** Opcional: lo envía el frontend cuando la OT se creó sin conexión. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID('4', { message: 'Vehículo inválido' })
  vehiculoId: string;

  @Transform(trim)
  @IsString({ message: 'Describa el problema reportado por el cliente' })
  @MinLength(5, { message: 'Describa el problema reportado (mínimo 5 caracteres)' })
  problemaReportado: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  kilometrajeIngreso: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  observacionesRecepcion?: string | null;

  @IsOptional()
  @IsUUID()
  mecanicoId?: string | null;

  /** Momento de ingreso registrado en el dispositivo (modo offline). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaIngreso?: Date;
}

export class UpdateOrdenDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(5)
  problemaReportado?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  observacionesRecepcion?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  diagnostico?: string | null;

  @IsOptional()
  @IsBoolean()
  sinRepuestos?: boolean;
}

export class AsignarMecanicoDto {
  @IsOptional()
  @IsUUID()
  mecanicoId: string | null;
}

export class CambiarEstadoDto {
  @IsEnum(EstadoOrden, { message: 'Estado inválido' })
  estado: EstadoOrden;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  comentario?: string | null;

  /** Momento del cambio en el dispositivo (modo offline). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fecha?: Date;
}

export class AgregarRepuestoDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID('4', { message: 'Repuesto inválido' })
  repuestoId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  cantidad: number;
}

export class FiltroOrdenesDto {
  @IsOptional()
  @IsEnum(EstadoOrden)
  estado?: EstadoOrden;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  abiertas?: boolean;

  @IsOptional()
  @IsUUID()
  vehiculoId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
