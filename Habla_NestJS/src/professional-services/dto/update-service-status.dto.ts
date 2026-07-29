import { IsEnum } from 'class-validator';
import { ProfessionalServiceStatus } from '@prisma/client';

export class UpdateServiceStatusDto {
  @IsEnum(ProfessionalServiceStatus)
  status!: ProfessionalServiceStatus;
}
