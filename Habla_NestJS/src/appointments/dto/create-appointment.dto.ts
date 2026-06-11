import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
