import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  Matches,
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
  ValidateNested,
} from 'class-validator';
import { EstadoOrden } from '../maquina-estados';
import { MetodoPago } from '../pago.entity';
import { OrigenRepuestoExterno } from '../orden-repuesto-externo.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** RN-33: repuesto elegido como motivo de ingreso. */
export class RepuestoSugeridoDto {
  @IsUUID('4', { message: 'Repuesto inválido' })
  repuestoId: string;

  @IsString()
  @MaxLength(200)
  nombre: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  cantidad: number;
}

export class CreateOrdenDto {
  /** Opcional: lo envía el frontend cuando la OT se creó sin conexión. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID('4', { message: 'Vehículo inválido' })
  vehiculoId: string;

  @Transform(trim)
  @IsString({ message: 'Indique el motivo de ingreso' })
  @MinLength(5, { message: 'Indique el motivo de ingreso (mínimo 5 caracteres)' })
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

  /** RN-26: día de entrega acordado con el cliente (AAAA-MM-DD). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha de entrega estimada inválida' })
  fechaEntregaEstimada?: string | null;

  /** RN-33: repuestos elegidos como motivo de ingreso. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepuestoSugeridoDto)
  repuestosSugeridos?: RepuestoSugeridoDto[];

  /** RN-27: costo aproximado informado al cliente en la recepción (Bs). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoEstimado?: number | null;
}

export class UpdateOrdenDto {
  /** RN-26: día de entrega acordado con el cliente (AAAA-MM-DD). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha de entrega estimada inválida' })
  fechaEntregaEstimada?: string | null;

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

// ---------------------------------------------------------------- Iteración 3

export class AgregarManoObraDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  /** Si se indica, la descripción y el monto se toman del catálogo (salvo que se envíen). */
  @IsOptional()
  @IsUUID()
  servicioId?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Describa el trabajo realizado' })
  @MaxLength(200)
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto?: number;

  @IsOptional()
  @IsUUID()
  mecanicoId?: string | null;
}

/** RN-28: repuesto que no sale del inventario. */
export class AgregarRepuestoExternoDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @Transform(trim)
  @IsString({ message: 'Indique qué repuesto es' })
  @MinLength(3, { message: 'Indique qué repuesto es' })
  @MaxLength(200)
  descripcion: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  cantidad: number;

  @IsEnum(OrigenRepuestoExterno, { message: 'Indique quién compra el repuesto' })
  origen: OrigenRepuestoExterno;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoUnitario?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario?: number;
}

/** RN-29: corregir precio o cantidad de un repuesto externo. */
export class EditarRepuestoExternoDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'La cantidad debe ser mayor a 0' })
  cantidad?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoUnitario?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string | null;
}

/** RN-29: corregir descripción o monto de una línea de mano de obra. */
export class EditarManoObraDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Describa el trabajo realizado' })
  @MaxLength(200)
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string | null;
}

export class DescuentoDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  descuento: number;
}

export class RegistrarPagoDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  monto: number;

  @IsEnum(MetodoPago, { message: 'Método de pago inválido' })
  metodo: MetodoPago;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  referencia?: string | null;

  /** Momento del cobro en el dispositivo (modo offline). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fecha?: Date;
}

export class AnularPagoDto {
  @Transform(trim)
  @IsString({ message: 'Indique el motivo de la anulación' })
  @MinLength(3, { message: 'Indique el motivo de la anulación' })
  @MaxLength(200)
  motivo: string;
}
