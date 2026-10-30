import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsDate,
  IsIn,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export const TIPOS_OPERACION = [
  'cliente.crear',
  'vehiculo.crear',
  'orden.crear',
  'orden.actualizar',
  'orden.mecanico',
  'orden.estado',
  'orden.repuesto.agregar',
  'orden.repuesto.quitar',
  // Iteración 3
  'orden.manoobra.agregar',
  'orden.manoobra.quitar',
  'orden.externo.agregar',
  'orden.externo.quitar',
  'orden.externo.editar',
  'orden.manoobra.editar',
  'orden.descuento',
  'orden.pago.registrar',
  'orden.pago.anular',
] as const;

export type TipoOperacion = (typeof TIPOS_OPERACION)[number];

export class OperacionDto {
  @IsUUID()
  id: string;

  @IsIn(TIPOS_OPERACION)
  tipo: TipoOperacion;

  /** Id de la orden sobre la que actúa (operaciones `orden.*` excepto crear). */
  @IsOptional()
  @IsUUID()
  ref?: string;

  @IsObject()
  datos: Record<string, unknown>;

  @Type(() => Date)
  @IsDate()
  creadaEn: Date;
}

export class SincronizarDto {
  @ValidateNested({ each: true })
  @Type(() => OperacionDto)
  @ArrayMaxSize(200)
  operaciones: OperacionDto[];
}

export interface ResultadoOperacion {
  id: string;
  ok: boolean;
  error?: string;
  /** Error temporal (servidor): el dispositivo debe reintentar más tarde. */
  reintentar?: boolean;
}
