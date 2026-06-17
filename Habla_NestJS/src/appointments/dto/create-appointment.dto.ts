import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { DocumentMode } from '@prisma/client';

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
}
