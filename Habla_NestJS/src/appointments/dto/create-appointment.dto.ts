import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DocumentMode } from '@prisma/client';
import { AttentionModality } from '@prisma/client';

export class CreateAppointmentDto {
  @IsUUID()
  professionalId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsBoolean()
  documentRequested?: boolean;

  @IsOptional()
  @IsString()
  documentCurrency?: string;

  @IsOptional()
  @IsEnum(DocumentMode)
  documentMode?: DocumentMode;

  @IsOptional()
  @IsEnum(AttentionModality)
  attentionMode?: AttentionModality;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  customerTaxName?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  customerTaxId?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  customerTaxAddress?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  customerTaxPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  customerTaxComment?: string;
}
