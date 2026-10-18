import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UNIDADES } from '../repuesto.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const cantidad = { maxDecimalPlaces: 2 };

export class CreateRepuestoDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[0-9A-Z._-]{2,30}$/, { message: 'Código inválido (letras, números, - . _)' })
  codigo: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  marca?: string | null;

  @IsOptional()
  @IsIn(UNIDADES)
  unidad?: string;

  /** Stock inicial: se registra como un movimiento de ENTRADA. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber(cantidad)
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(cantidad)
  @Min(0)
  stockMinimo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(cantidad)
  @Min(0)
  precioCompra?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(cantidad)
  @Min(0)
  precioVenta?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  ubicacion?: string | null;
}

/** El stock no se edita directamente: solo con entradas o ajustes. */
export class UpdateRepuestoDto extends PartialType(OmitType(CreateRepuestoDto, ['stock'] as const)) {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class EntradaStockDto {
  @Type(() => Number)
  @IsNumber(cantidad)
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  cantidad: number;

  /** Si se indica, actualiza el precio de compra del repuesto. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber(cantidad)
  @Min(0)
  precioCompra?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string | null;
}

export class AjusteStockDto {
  /** Stock contado físicamente. */
  @Type(() => Number)
  @IsNumber(cantidad)
  @Min(0)
  stockReal: number;

  @Transform(trim)
  @IsString({ message: 'Indique el motivo del ajuste' })
  @MinLength(3, { message: 'Indique el motivo del ajuste' })
  @MaxLength(200)
  motivo: string;
}
