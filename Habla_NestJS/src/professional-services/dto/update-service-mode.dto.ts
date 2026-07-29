import { IsEnum } from 'class-validator';
import { ProfessionalServiceMode } from '@prisma/client';

export class UpdateServiceModeDto {
  @IsEnum(ProfessionalServiceMode)
  serviceMode!: ProfessionalServiceMode;
}
