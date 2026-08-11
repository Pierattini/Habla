import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProfessionalTimeBlockType } from '@prisma/client';

export class CreateProfessionalTimeBlockDto {
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsEnum(ProfessionalTimeBlockType)
  type!: ProfessionalTimeBlockType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
