import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateManualAppointmentDto {
  @IsUUID()
  customerId!: string;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
