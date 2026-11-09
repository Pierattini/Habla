import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Boleta para una sesión que no se agendó por Conecta (por ejemplo, sesiones ya realizadas).
export class CreateManualBoletaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName!: string;

  @IsEmail()
  @MaxLength(160)
  customerEmail!: string;

  // RUT del paciente; si no se indica, la boleta sale al RUT genérico 66666666-6.
  @IsOptional()
  @IsString()
  @Matches(/^\s*[\d.]{1,12}-?[\dkK]\s*$/, { message: 'RUT inválido' })
  customerTaxId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amount!: number;

  // El detalle de la boleta admite 80 caracteres (máximo del SII).
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  customerAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerCity?: string;

  // Fecha de la sesión (YYYY-MM-DD).
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  sessionDate!: string;
}
