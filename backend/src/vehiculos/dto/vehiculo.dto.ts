import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { normalizarPlaca } from '../../common/utils/placa.util';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export const COMBUSTIBLES = ['GASOLINA', 'DIESEL', 'GNV', 'GASOLINA/GNV', 'ELECTRICO', 'HIBRIDO'];

export class CreateVehiculoDto {
  /** Opcional: lo envía el frontend cuando el vehículo se registró sin conexión. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID('4', { message: 'Cliente inválido' })
  clienteId: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizarPlaca(value) : value,
  )
  @Matches(/^[0-9A-Z]{5,10}$/, {
    message: 'Placa inválida (ej. 2345ABC)',
  })
  placa: string;

  @Transform(trim)
  @IsString()
  @MaxLength(50)
  marca: string;

  @Transform(trim)
  @IsString()
  @MaxLength(50)
  modelo: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear() + 1)
  anio?: number | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  nroChasis?: string | null;

  @IsOptional()
  @IsIn(COMBUSTIBLES)
  combustible?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  kilometraje?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  observaciones?: string | null;
}

export class UpdateVehiculoDto extends PartialType(OmitType(CreateVehiculoDto, ['id'] as const)) {}
